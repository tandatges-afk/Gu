import {NextRequest,NextResponse,after} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError,requireAdmin,requirePcStaff} from '@/lib/http';
import {billableBlocks,vnDayKey} from '@/lib/hourly-pricing';
import {rentalCharge,cameraPackageSnapshot,chosenCameraPackageSnapshot,isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import {orderGroup,itemsBelongToGroup} from '@/lib/order-group';
import {approvedLineQuote} from '@/lib/v5-review-pricing';
import {returnReconciliation} from '@/lib/settlement-ledger';
import {completeProof,type PhotoProof,type Capture} from '@/lib/inspection-proof';
import {intervalRefs,checkIntervalAvailability,createIntervalWrites,removeOrderIntervals,requiredTemplates,simpleId} from '@/lib/v5-server';
import {syncDebtIndex} from '@/lib/debt-index';
import {auditInTransaction} from '@/lib/audit';
import {FieldValue,type Transaction} from '@/lib/pg-firestore';
import {addCompletedRound,type InspectionRound} from '@/lib/evidence-retention-rules';
import {runEvidenceCleanup} from '@/lib/evidence-retention';
import {queueSensitiveEvidenceCleanup,runSensitiveEvidenceCleanup} from '@/lib/sensitive-evidence-cleanup';
import {finalRent,handoverBillingStart} from '@/lib/gu-v52-workflow';
import {readVerifiedEvidence} from '@/lib/secure-evidence';
import type {RentalOrder,InventoryItem} from '@/lib/types';
export const runtime='nodejs';
const cloud=()=>process.env.CLOUDINARY_CLOUD_NAME||'';
function readProof(raw:unknown,order:RentalOrder,uid:string,name:string,phase:'HANDOVER'|'RETURN',now:string):PhotoProof[]{
 const targetIds=phase==='HANDOVER'&&order.pendingExtraItemIds?.length?order.pendingExtraItemIds:order.lines.map(l=>l.itemId);
 if(!Array.isArray(raw)||raw.length!==targetIds.length)throw new ApiError(400,'Phải chụp đủ mọi sản phẩm trong đợt giao/nhận.');
 const templates=requiredTemplates(order);
 const result:PhotoProof[]=raw.map((entry:unknown)=>{
  if(!entry||typeof entry!=='object')throw new ApiError(400,'Bộ ảnh không hợp lệ.');
  const p=entry as Record<string,unknown>;const id=String(p.itemId||'');
  if(!targetIds.includes(id))throw new ApiError(400,'Sản phẩm không thuộc đợt chụp.');
  const slots=templates[id];if(!slots)throw new ApiError(400,'Chưa có cấu hình góc chụp.');
  const condition=p.condition==='MISSING'?'MISSING':p.condition==='ISSUE'?'ISSUE':'OK';
  const missing=phase==='RETURN'&&condition==='MISSING';
  if(phase==='RETURN'&&(missing||condition==='ISSUE')&&(!p.note||typeof p.note!=='string'||!p.note.trim()))throw new ApiError(400,'Đồ thiếu hoặc có vấn đề phải ghi chú hiện trạng để Admin đối chiếu.');
  const shots=Object.fromEntries(slots.map(angle=>{
   const url=(p.shots as Record<string,unknown>|undefined)?.[angle];
   // URL belongs to the authenticated uploader and this order. Public URLs alone cannot be trusted.
   const prefix=`https://res.cloudinary.com/${cloud()}/image/upload/`;
   if(missing&&!url)return null;
   if(typeof url!=='string'||!url.startsWith(prefix)||!new RegExp(`/gu/inspections/${uid}/${order.id}/${phase.toLowerCase()}/[a-f0-9-]{36}\\.(?:jpg|png|webp)$`).test(url))throw new ApiError(400,`Ảnh ${angle} chưa được tải lên đúng đơn hoặc đúng nhân viên.`);
   return [angle,{url,at:now,by:uid,byName:name} satisfies Capture];
  }).filter((entry):entry is [string,Capture]=>entry!==null));
  return {itemId:id,shots,condition,note:typeof p.note==='string'?p.note.slice(0,500):''};
 });
 if(result.length!==targetIds.length||new Set(result.map(p=>p.itemId)).size!==result.length||result.some(p=>p.condition!=='MISSING'&&!templates[p.itemId]?.every(a=>!!p.shots[a]?.url)))throw new ApiError(400,'Thiếu ảnh của sản phẩm hoặc góc chụp.');
 return result;
}
async function verifyProofUploads(tx:Transaction,proofs:PhotoProof[],phase:'handover'|'return',uid:string,orderId:string){
 const paths=proofs.flatMap(p=>Object.values(p.shots).filter(Boolean).map(c=>c.url));
 if(new Set(paths).size!==paths.length)throw new ApiError(400,'Không dùng một ảnh cho nhiều góc chụp.');
 const ids=paths.map(url=>url.match(/\/([a-f0-9-]{36})\.(?:jpg|jpeg|png|webp)$/)?.[1]);
 if(ids.some(x=>!x))throw new ApiError(400,'Đường dẫn ảnh kiểm nhận không hợp lệ.');
 const uploads=await Promise.all(ids.map(x=>tx.get(db().collection('proofUploads').doc(x!))));
 if(uploads.some((s,i)=>!s.exists||s.data()?.url!==paths[i]||s.data()?.uid!==uid||s.data()?.orderId!==orderId||s.data()?.phase!==phase))throw new ApiError(400,'Ảnh chưa được tải lên từ tài khoản và đơn này.');
}
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{const me=await staffUser(req);const {id}=await ctx.params;if(!simpleId(id))throw new ApiError(400,'Mã đơn không hợp lệ.');
 const snap=await db().collection('orders').doc(id).get();if(!snap.exists||!snap.data()?.pricingVersion)throw new ApiError(404,'Không tìm thấy đơn quy trình mới.');
 const order={id:snap.id,...snap.data()} as RentalOrder;

 const ids=order.lines.map(x=>x.itemId);const itemSnaps=await Promise.all(ids.map(x=>db().collection('items').doc(x).get()));
 // Admin-only reconciliation history; never expose payment methods to other staff.
 const payments=me.role==='admin'?(await db().collection('orders').doc(id).collection('cashMovements').orderBy('createdAt','desc').limit(100).get()).docs.map(s=>({id:s.id,...s.data()})):[];
 return NextResponse.json({order,payments,items:itemSnaps.map((d,i)=>({id:ids[i],...d.data()}))},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/orders/[id]');}
}
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{
  const me=await staffUser(req);const {id}=await ctx.params;if(!simpleId(id))throw new ApiError(400,'Mã đơn không hợp lệ.');
  const b=await jsonBody(req);const action=String(b.action||'');
  if(!['HANDOVER','RECEIVE','APPROVE_RETURN','VOID','PAY','CANCEL','EXTEND','ADD_ITEMS','HANDOVER_EXTRA','AUTO_RESOLVE_CAMERA_LATE','REVIEW_PHOTOS','REFUND_RETURN','REFUND_RESERVATION','APPLY_SURCHARGE','RETURN_COLLATERAL','FINALIZE_LEGACY_RETURN'].includes(action))throw new ApiError(400,'Thao tác không hợp lệ.');
  if(['VOID','CANCEL','APPROVE_RETURN','AUTO_RESOLVE_CAMERA_LATE','REVIEW_PHOTOS','REFUND_RETURN','REFUND_RESERVATION'].includes(action))requireAdmin(me);
  if(['PAY','EXTEND','ADD_ITEMS'].includes(action))requirePcStaff(me);
  const ref=db().collection('orders').doc(id);const job=db().collection('mobileJobs').doc(id);
  const now=new Date().toISOString();
  await db().runTransaction(async tx=>{
   const orderSnap=await tx.get(ref);if(!orderSnap.exists||!orderSnap.data()?.pricingVersion)throw new ApiError(404,'Đơn không thuộc quy trình mới.');
   const order={id:orderSnap.id,...orderSnap.data()} as RentalOrder;
   if(['CANCELLED','VOIDED'].includes(order.status)||(order.status==='RETURNED'&&!['PAY','VOID','AUTO_RESOLVE_CAMERA_LATE','REVIEW_PHOTOS','REFUND_RETURN','REFUND_RESERVATION','APPLY_SURCHARGE','RETURN_COLLATERAL','FINALIZE_LEGACY_RETURN'].includes(action)))throw new ApiError(409,'Đơn đã đóng.');
   const itemRefs=order.lines.map(l=>db().collection('items').doc(l.itemId));
   if(action==='HANDOVER'){
    if(order.status!=='RESERVED')throw new ApiError(409,'Đơn đã được giao hoặc đóng.');
    // An early physical handover needs an additional atomic interval lock, otherwise
    // the same item can be reserved by a second customer before its planned pickup.
    const earlyHandover=Date.parse(now)<Date.parse(order.pickupAt||'');
    const earlySlots=earlyHandover?intervalRefs(order.lines.map(l=>l.itemId),now,order.pickupAt!):[];
    const proofs=readProof(b.items,order,me.uid,me.name,'HANDOVER',now);
    const snaps=await Promise.all(itemRefs.map(r=>tx.get(r)));
    await verifyProofUploads(tx,proofs,'handover',me.uid,id);
    const earlyPrior=earlySlots.length?await checkIntervalAvailability(tx,earlySlots,id):[];
    const depositProofId=String(b.depositProofId||'');
    const depositKind=String(b.depositKind||'');
    if(depositProofId&&!['CCCD','CASH','OTHER'].includes(depositKind))throw new ApiError(400,'Chọn loại vật cọc đã nhận.');
    const depositEvidence=depositProofId?await readVerifiedEvidence(tx,depositProofId,me.uid,'deposit',String(b.depositDraftId||'')):null;
    if(snaps.some(s=>!s.exists||s.data()?.status!=='AVAILABLE'))throw new ApiError(409,'Có món đang cho thuê hoặc chưa giặt.');
    // Reserved rentals keep their original scheduled pickup time for pricing and timeline
    // even when the customer comes later, so the planned slot remains authoritative.
    if(Date.parse(now)>=Date.parse(order.returnAt||''))throw new ApiError(409,'Giờ trả dự kiến đã qua; PC cần cập nhật lịch trước khi giao.');
    const billingStart=handoverBillingStart({bookingKind:order.bookingKind,scheduledPickupAt:order.scheduledPickupAt,pickupAt:order.pickupAt,actualHandoverAt:now});
    const actualLines=order.lines.map(l=>{const startAt=order.bookingKind==='RESERVE'?(l.startAt||billingStart):billingStart;return {...l,startAt,lineTotal:rentalCharge(l,startAt,order.returnAt!)};});
    const computedTotal=actualLines.reduce((sum,l)=>sum+Number(l.lineTotal||0),0);
    const actualTotal=order.bookingKind==='RESERVE'?Math.max(order.bookedRentTotal||order.total,computedTotal):computedTotal;
    if(earlySlots.length)createIntervalWrites(tx,earlySlots,earlyPrior,id);
    if(depositEvidence)tx.update(depositEvidence.ref,{consumedOrderId:id,consumedAt:now});
    tx.update(ref,{status:'PICKED_UP',scheduledPickupAt:order.scheduledPickupAt||order.pickupAt,lines:actualLines,total:actualTotal,...(depositEvidence?{handoverDepositProofId:depositProofId,handoverDepositKind:depositKind}:{}),handoverProof:{status:'SUBMITTED',by:me.uid,byName:me.name,at:now,items:proofs},updatedAt:now,history:[...order.history,{action:'HANDOVER_PHOTOS',by:me.uid,at:now,detail:`Nhân viên ${me.name} đã chụp ${proofs.length} sản phẩm và giữ nguyên giờ thuê theo lịch hẹn`} ]});
    itemRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:id,expectedReturnDate:order.returnDate}));
    tx.set(job,{stage:'OUT',code:order.code,orderId:id,customerName:order.customerName,returnAt:order.returnAt,updatedAt:now},{merge:true});
    syncDebtIndex(tx,db(),{...order,lines:actualLines,total:actualTotal,status:'PICKED_UP',updatedAt:now});
   }else if(action==='HANDOVER_EXTRA'){
    if(order.status!=='PICKED_UP'||!order.pendingExtraItemIds?.length||order.returnStage==='AWAITING_ADMIN')throw new ApiError(409,'Không có đồ bổ sung cần giao.');
    const pending=order.pendingExtraItemIds;
    const pendingRefs=pending.map(x=>db().collection('items').doc(x));
    const proofs=readProof(b.items,order,me.uid,me.name,'HANDOVER',now);
    const snaps=await Promise.all(pendingRefs.map(x=>tx.get(x)));
    await verifyProofUploads(tx,proofs,'handover',me.uid,id);
    const existingPhotoUrls=new Set((order.handoverProof?.items||[]).flatMap(p=>Object.values(p.shots||{}).map(v=>v.url)));
    if(proofs.some(p=>Object.values(p.shots).some(v=>existingPhotoUrls.has(v.url))))throw new ApiError(409,'Ảnh giao bổ sung không được dùng lại ảnh của món đã giao trước đó.');
    if(snaps.some(s=>!s.exists||s.data()?.status!=='AVAILABLE'))throw new ApiError(409,'Có món bổ sung không còn sẵn sàng.');
    const updates=order.lines.map(l=>pending.includes(l.itemId)?{...l,startAt:now}:l);
    const nextTotal=updates.reduce((sum,l,i)=>{
      return sum+rentalCharge(l,updates[i].startAt||order.pickupAt!,order.returnAt!);
    },0);
    tx.update(ref,{lines:updates,total:nextTotal,pendingExtraItemIds:[],handoverProof:{...order.handoverProof,status:'SUBMITTED',items:[...(order.handoverProof?.items||[]),...proofs]},updatedAt:now,history:[...order.history,{action:'HANDOVER_EXTRA',at:now,by:me.uid,detail:`${me.name} giao bổ sung ${pending.length} món, đã chụp ảnh`} ]});
    pendingRefs.forEach(r=>tx.update(r,{status:'RENTED',currentOrderId:id,expectedReturnDate:order.returnDate}));
    tx.set(job,{stage:'OUT',updatedAt:now},{merge:true});
    syncDebtIndex(tx,db(),{...order,lines:updates,total:nextTotal,updatedAt:now});
   }else if(action==='RECEIVE'){
    // Warehouse release and financial calculation belong to the staff return action.
    // Admin reviews photos asynchronously: no blocking REVIEW state on stock.
    if(order.status!=='PICKED_UP'||order.pendingExtraItemIds?.length||order.returnStage==='AWAITING_ADMIN')throw new ApiError(409,'Đơn không ở trạng thái nhận trả được.');
    if(!order.handoverProof?.items?.length)throw new ApiError(409,'Chưa có ảnh bàn giao.');
    const proofs=readProof(b.items,order,me.uid,me.name,'RETURN',now);
    await verifyProofUploads(tx,proofs,'return',me.uid,id);
    const snaps=await Promise.all(itemRefs.map(r=>tx.get(r)));
    if(snaps.some(s=>!s.exists||s.data()?.status!=='RENTED'||s.data()?.currentOrderId!==id))throw new ApiError(409,'Kho không còn thuộc đơn này, không thể tự nhận trả.');
    const endTime=now;
    const quote=order.lines.map(l=>approvedLineQuote(l,
      order.bookingKind==='RESERVE'&&Date.parse(endTime)>Date.parse(order.returnAt||'')
       ? (order.scheduledPickupAt||order.pickupAt!)
       : (l.startAt||order.handoverProof!.at||order.pickupAt!),endTime));
    const pendingCameraIds=order.lines.flatMap((l,i)=>quote[i].pendingCameraLatePricing?[l.itemId]:[]);
    const quoted=quote.reduce((sum,v)=>sum+v.amount,0);
    const rent=finalRent({bookedRent:order.bookedRentTotal||order.total,quotedRent:quoted,prepaid:order.bookingKind==='RESERVE',scheduledReturn:order.returnAt||now,actualReturn:endTime});
    const compensation=proofs.reduce((sum,p)=>sum+(p.condition==='MISSING'?Number(order.lines.find(l=>l.itemId===p.itemId)?.replacementValue||0):0),0);
    if(proofs.some(p=>p.condition==='MISSING'&&!order.lines.find(l=>l.itemId===p.itemId)?.replacementValue))throw new ApiError(409,'Món thiếu chưa được định giá đền bù.');
    const nextDue=rent+compensation+(order.otherFeeTotal||0);
    const refundPending=Math.max(0,(order.paid||0)-nextDue);
    const release=await removeOrderIntervals(tx,order);
    const actualBlocks=billableBlocks(order.handoverProof!.at||order.pickupAt!,endTime);
    const returnProof={status:'SUBMITTED' as const,by:me.uid,byName:me.name,at:endTime,items:proofs};
    const revised={...order,status:'RETURNED' as const,returnStage:'APPROVED' as const,returnProof,total:rent,compensationTotal:compensation,lateFeeTotal:0,rentalDays:actualBlocks,returnedAt:now,refundPending,photoReviewStatus:'PENDING' as const,cameraLatePendingItemIds:pendingCameraIds,cameraLateFeePending:pendingCameraIds.length>0,cameraOvertimeFeeTotal:quote.reduce((sum,v)=>sum+v.cameraLateFee,0),updatedAt:now};
    syncDebtIndex(tx,db(),revised);
    tx.update(ref,{status:'RETURNED',returnStage:'APPROVED',returnProof,total:rent,compensationTotal:compensation,lateFeeTotal:0,rentalDays:actualBlocks,returnedAt:now,refundPending,photoReviewStatus:'PENDING',cameraLatePendingItemIds:pendingCameraIds,cameraLateFeePending:pendingCameraIds.length>0,cameraOvertimeFeeTotal:revised.cameraOvertimeFeeTotal,updatedAt:now,history:[...order.history,{action:'STAFF_RETURN_COMPLETE',at:now,by:me.uid,detail:'Đã nhận và hoàn kho độc lập với Admin; ảnh lưu chờ kiểm tra hậu kiểm'}]});
    itemRefs.forEach((r,i)=>{const p=proofs.find(v=>v.itemId===order.lines[i].itemId);const item=snaps[i].data() as InventoryItem;const state=p?.condition==='MISSING'?'MISSING':p?.condition==='ISSUE'?'MAINTENANCE':item.requiresLaundry===false?'AVAILABLE':'LAUNDRY';tx.update(r,{status:state,currentOrderId:null,expectedReturnDate:null,...(state==='LAUNDRY'?{laundryStartedAt:now,laundryCompletedAt:null}:{})});});
    release?.();tx.set(job,{stage:'REVIEW',orderId:id,code:order.code,customerName:order.customerName,updatedAt:now},{merge:true});
   }else if(action==='REVIEW_PHOTOS'){
    if(order.status!=='RETURNED'||order.photoReviewStatus!=='PENDING'||!order.returnProof)throw new ApiError(409,'Không có ảnh trả hàng chờ kiểm tra.');
    // Preserve seven complete handover+return photo rounds per physical item;
    // an employee's RECEIVE alone is not an Admin-approved round.
    const trackerRefs=order.lines.map(l=>db().collection('inspectionEvidence').doc(l.itemId));
    const trackers=await Promise.all(trackerRefs.map(r=>tx.get(r)));
    trackerRefs.forEach((trackerRef,i)=>{
     const itemId=order.lines[i].itemId;
     const hasHandover=Object.values(order.handoverProof?.items.find(p=>p.itemId===itemId)?.shots||{}).some(s=>!!s.url);
     const hasReturn=Object.values(order.returnProof?.items.find(p=>p.itemId===itemId)?.shots||{}).some(s=>!!s.url);
     if(!hasHandover||!hasReturn)return;
     const result=addCompletedRound((trackers[i].data()?.rounds||[]) as InspectionRound[],{orderId:id,completedAt:now});
     tx.set(trackerRef,{itemId,rounds:result.keep,updatedAt:now});
     for(const old of result.expired)tx.set(db().collection('inspectionCleanup').doc(itemId+'_'+old.orderId),{itemId,orderId:old.orderId,triggerOrderId:id,createdAt:now},{merge:true});
    });
    tx.update(ref,{photoReviewStatus:'REVIEWED',photoReviewedBy:me.uid,photoReviewedAt:now,sensitiveEvidenceStatus:'DELETING',updatedAt:now,history:[...order.history,{action:'PHOTO_REVIEWED',by:me.uid,at:now,detail:'Admin duyệt ảnh; đã lập lệnh xóa chứng từ nhạy cảm khỏi Cloudinary'}]});
    queueSensitiveEvidenceCleanup(tx,id,now);
    tx.set(job,{stage:'DONE',updatedAt:now},{merge:true});
   }else if(action==='RETURN_COLLATERAL'){
    if(order.status!=='RETURNED'||!(order.handoverDepositProofId||order.hadHandoverDeposit))throw new ApiError(409,'Đơn chưa trả hoặc không có vật cọc cần hoàn lại.');
    if(order.collateralReturnedAt)throw new ApiError(409,'Vật cọc đã được xác nhận hoàn lại.');
    if(b.confirmReturned!==true)throw new ApiError(400,'Chưa xác nhận đã trao trả vật cọc.');
    tx.update(ref,{collateralReturnedAt:now,collateralReturnedBy:me.uid,updatedAt:now,history:[...order.history,{action:'COLLATERAL_RETURNED',by:me.uid,at:now,detail:`Đã hoàn lại trực tiếp vật cọc loại ${order.handoverDepositKind||'OTHER'}, không chụp lại`}]});
   }else if(action==='REFUND_RESERVATION'){
    if(order.status!=='RESERVED'||order.paid<=0)throw new ApiError(409,'Chỉ hoàn trước khi hủy lịch có tiền đã thu.');
    const method=String(b.method||'');const reference=String(b.reference||'').trim().slice(0,100);
    if(b.confirmRefund!==true||!['CASH','TRANSFER'].includes(method)||method==='TRANSFER'&&reference.length<4)throw new ApiError(400,'Chỉ ghi nhận sau khi đã hoàn đủ tiền cho khách.');
    const amount=order.paid;
    const revised={...order,paid:0,refundTotal:(order.refundTotal||0)+amount,updatedAt:now};syncDebtIndex(tx,db(),revised);
    tx.update(ref,{paid:0,refundTotal:revised.refundTotal,updatedAt:now,history:[...order.history,{action:'RESERVATION_REFUNDED',by:me.uid,at:now,amount,detail:`Đã hoàn toàn bộ tiền đặt trước ${method}: ${reference}. Cần hủy lịch sau bước này.`}]});
    tx.create(ref.collection('cashMovements').doc(),{orderId:id,kind:'REFUND',amount,method,reference,actorUid:me.uid,actorName:me.name,createdAt:now,description:'Hoàn tiền đặt trước để hủy lịch'});
    tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(-amount),refunds:FieldValue.increment(1),updatedAt:now},{merge:true});
   }else if(action==='APPLY_SURCHARGE'){
    if(order.status!=='RETURNED')throw new ApiError(409,'Chỉ thêm phụ thu sau khi nhận trả.');
    const amount=Number(b.amount);const reason=String(b.reason||'').trim().slice(0,300);
    if(!Number.isSafeInteger(amount)||amount<1||amount>100_000_000||reason.length<3)throw new ApiError(400,'Nhập tiền phụ thu và lý do hợp lệ.');
    const extra=(order.otherFeeTotal||0)+amount;const refundPending=Math.max(0,order.paid-order.total-(order.compensationTotal||0)-extra);const revised={...order,otherFeeTotal:extra,refundPending,updatedAt:now};syncDebtIndex(tx,db(),revised);
    tx.update(ref,{otherFeeTotal:extra,refundPending,updatedAt:now,history:[...order.history,{action:'EXTRA_CHARGE',by:me.uid,at:now,amount,detail:reason}]});
   }else if(action==='REFUND_RETURN'){
    if(order.status!=='RETURNED')throw new ApiError(409,'Đơn chưa kết thúc.');
    const expectedRefund=Math.max(0,order.paid-order.total-(order.compensationTotal||0)-(order.otherFeeTotal||0));
    if(expectedRefund<=0)throw new ApiError(409,'Đơn không cần hoàn tiền.');
    const method=String(b.method||'');const reference=String(b.reference||'').trim().slice(0,100);
    if(b.confirmRefund!==true||!['CASH','TRANSFER'].includes(method)||method==='TRANSFER'&&reference.length<4)throw new ApiError(400,'Xác nhận đã hoàn tiền thực tế và mã chuyển khoản nếu có.');
    const nextPaid=order.paid-expectedRefund;const revised={...order,paid:nextPaid,refundTotal:(order.refundTotal||0)+expectedRefund,refundPending:0,updatedAt:now};syncDebtIndex(tx,db(),revised);
    tx.update(ref,{paid:nextPaid,refundTotal:revised.refundTotal,refundPending:0,updatedAt:now,history:[...order.history,{action:'REFUND_RETURN',by:me.uid,at:now,amount:expectedRefund,detail:`Đã thực hiện hoàn ${method}: ${reference}`}]});
    tx.create(ref.collection('cashMovements').doc(),{orderId:id,kind:'REFUND',amount:expectedRefund,method,reference,actorUid:me.uid,actorName:me.name,createdAt:now,description:'Hoàn tiền thực tế sau khi nhận hàng'});
    tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(-expectedRefund),refunds:FieldValue.increment(1),updatedAt:now},{merge:true});
   }else if(action==='APPROVE_RETURN'||action==='FINALIZE_LEGACY_RETURN'){
    if(order.status!=='PICKED_UP'||order.returnStage!=='AWAITING_ADMIN'||!order.returnProof?.at||!order.pickupAt||!order.returnAt)throw new ApiError(409,'Đơn chưa có ảnh nhận trả để duyệt.');
    const trackerRefs=order.lines.map(l=>db().collection('inspectionEvidence').doc(l.itemId));
    const [snaps,trackers]=await Promise.all([Promise.all(itemRefs.map(r=>tx.get(r))),Promise.all(trackerRefs.map(r=>tx.get(r)))]);
    if(snaps.some(s=>!s.exists||s.data()?.status!=='RENTED'||s.data()?.currentOrderId!==id))throw new ApiError(409,'Có sản phẩm không còn thuộc đơn, cần đối chiếu.');
    const release=await removeOrderIntervals(tx,order);
    const actualBlocks=billableBlocks(order.handoverProof?.at||order.pickupAt,order.returnProof.at);
    const quote=order.lines.map(l=>approvedLineQuote(l,l.startAt||order.handoverProof!.at||order.pickupAt!,order.returnProof!.at!));
    const pendingCameraIds=order.lines.flatMap((l,i)=>quote[i].pendingCameraLatePricing?[l.itemId]:[]);
    const cameraOvertimeFeeTotal=quote.reduce((sum,q)=>sum+q.cameraLateFee,0);
    const rent=quote.reduce((sum,p)=>sum+p.amount,0);
    const compensation=order.returnProof.items.reduce((sum,p,i)=>sum+(p.condition==='MISSING'?Number(order.lines.find(l=>l.itemId===p.itemId)?.replacementValue||0):0),0);
    if(order.returnProof.items.some(p=>p.condition==='MISSING'&&!order.lines.find(l=>l.itemId===p.itemId)?.replacementValue))throw new ApiError(409,'Có sản phẩm thiếu nhưng chưa định giá đền bù.');
    const otherFee=Number(b.otherFeeTotal||0);if(!Number.isSafeInteger(otherFee)||otherFee<0||otherFee>100_000_000)throw new ApiError(400,'Phụ phí khác không hợp lệ.');
    const note=typeof b.surchargeNote==='string'?b.surchargeNote.slice(0,300):'';if(otherFee>0&&!note)throw new ApiError(400,'Ghi lý do phụ phí khác.');
    const paidTotal=order.paid||0;
    const refundDue=returnReconciliation({rent,compensation,otherFee,netPaid:paidTotal}).refund;
    const refundMethod=String(b.refundMethod||'');
    const refundReference=String(b.refundReference||'').trim().slice(0,100);
    if(refundDue>0&&(b.confirmRefund!==true||!['CASH','TRANSFER'].includes(refundMethod)))
      throw new ApiError(409,`Cần xác nhận đã hoàn ${refundDue.toLocaleString('vi-VN')}đ qua tiền mặt/chuyển khoản trước khi duyệt.`);
    if(refundDue>0&&refundMethod==='TRANSFER'&&refundReference.length<4)
      throw new ApiError(400,'Nhập mã giao dịch hoặc nội dung chuyển khoản hoàn tiền.');
    const netPaid=paidTotal-refundDue;
    if(refundDue>0){
      // This action only RECORDS a completed manual refund; it does not transfer funds.
      const movement=ref.collection('cashMovements').doc();
      tx.create(movement,{orderId:id,kind:'REFUND',amount:refundDue,method:refundMethod,reference:refundReference,
        actorUid:me.uid,actorName:me.name,createdAt:now,description:'Hoàn tiền đã thực hiện khi duyệt trả hàng'});
      tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(-refundDue),refunds:FieldValue.increment(1),updatedAt:now},{merge:true});
    }
    const status:'RETURNED'='RETURNED';
    const lateFeeTotal=Math.max(0,rent-order.total);
    // v5 stores actual rental amount as total, not total + separate late charge.
    const revised={...order,total:rent,paid:netPaid,refundTotal:(order.refundTotal||0)+refundDue,status,compensationTotal:compensation,otherFeeTotal:otherFee,lateFeeTotal:0,rentalDays:actualBlocks,cameraLateFeePending:pendingCameraIds.length>0,cameraLatePendingItemIds:pendingCameraIds,cameraOvertimeFeeTotal,returnStage:'APPROVED' as const,updatedAt:now};
    syncDebtIndex(tx,db(),revised);
    tx.update(ref,{total:rent,paid:netPaid,refundTotal:(order.refundTotal||0)+refundDue,status,compensationTotal:compensation,otherFeeTotal:otherFee,lateFeeTotal:0,rentalDays:actualBlocks,cameraLateFeePending:pendingCameraIds.length>0,cameraLatePendingItemIds:pendingCameraIds,cameraOvertimeFeeTotal,returnStage:'APPROVED',reviewedBy:me.uid,reviewedByName:me.name,reviewedAt:now,returnedAt:order.returnProof.at,sensitiveEvidenceStatus:'DELETING',updatedAt:now,history:[...order.history,{action:'ADMIN_APPROVE_RETURN',by:me.uid,at:now,amount:rent,detail:`Duyệt nhận; thuê ${rent}, tăng thời gian ${lateFeeTotal}, đền bù ${compensation}, phụ phí ${otherFee} (${note}), hoàn thực tế ${refundDue} (${refundMethod||'không có'}); phí máy ảnh ${cameraOvertimeFeeTotal}`}]});
    itemRefs.forEach((r,i)=>{const missing=order.returnProof?.items.find(p=>p.itemId===order.lines[i].itemId)?.condition==='MISSING';const item=snaps[i].data() as InventoryItem;const issue=order.returnProof?.items.find(p=>p.itemId===order.lines[i].itemId)?.condition==='ISSUE';const state=missing?'MISSING':issue?'MAINTENANCE':item.requiresLaundry===false?'AVAILABLE':'LAUNDRY';tx.update(r,{status:state,currentOrderId:null,expectedReturnDate:null,...(state==='LAUNDRY'?{laundryStartedAt:now,laundryCompletedAt:null}:{})});});
    // A completed handover+return is ONE round per individual physical asset.
    trackerRefs.forEach((trackerRef,i)=>{
      const itemId=order.lines[i].itemId;
      const hasHandover=Object.values(order.handoverProof?.items.find(p=>p.itemId===itemId)?.shots||{}).some(s=>Boolean(s.url));
      const hasReturn=Object.values(order.returnProof?.items.find(p=>p.itemId===itemId)?.shots||{}).some(s=>Boolean(s.url));
      if(!hasHandover||!hasReturn)return; // Missing device: not a complete matched pair.
      const rounds=(trackers[i].data()?.rounds||[]) as InspectionRound[];
      const result=addCompletedRound(rounds,{orderId:id,completedAt:now});
      tx.set(trackerRef,{itemId:order.lines[i].itemId,rounds:result.keep,updatedAt:now});
      for(const old of result.expired){
        const cleanupId=order.lines[i].itemId+'_'+old.orderId;
        tx.set(db().collection('inspectionCleanup').doc(cleanupId),{itemId:order.lines[i].itemId,orderId:old.orderId,triggerOrderId:id,createdAt:now},{merge:true});
      }
    });
    queueSensitiveEvidenceCleanup(tx,id,now);
    release?.();tx.set(job,{stage:'DONE',updatedAt:now},{merge:true});
   }else if(action==='VOID'||action==='CANCEL'){
    if(action==='CANCEL'&&order.status!=='RESERVED')throw new ApiError(409,'Đơn đã giao, chỉ Admin được hủy có kiểm nhận vật lý.');
    if(action==='VOID'&&b.confirmCleanItems!==true)throw new ApiError(400,'Admin phải xác nhận tất cả đồ đã được kiểm nhận và sạch trước khi hủy.');
    if(order.paid>0)throw new ApiError(409,'Đơn đã thu tiền: cần hoàn tiền/đối soát trước khi xóa.');
    const snaps=await Promise.all(itemRefs.map(r=>tx.get(r)));
    if(snaps.some(s=>!s.exists)|| (action==='VOID'&&snaps.some(s=>s.data()?.currentOrderId&&s.data()?.currentOrderId!==id)))throw new ApiError(409,'Trạng thái kho đã thay đổi, không thể xóa.');
    const release=await removeOrderIntervals(tx,order);
    const newStatus=action==='VOID'?'VOIDED':'CANCELLED';
    queueSensitiveEvidenceCleanup(tx,id,now);
    tx.update(ref,{sensitiveEvidenceStatus:'DELETING',status:newStatus,voidedAt:action==='VOID'?now:null,voidedBy:action==='VOID'?me.uid:null,updatedAt:now,history:[...order.history,{action:action==='VOID'?'ADMIN_VOID':'CANCEL',by:me.uid,at:now,detail:action==='VOID'?'Đã xác nhận thu đủ đồ sạch, khóa đơn và hoàn kho':'Hủy lịch chưa giao'}]});
    if(action==='VOID')itemRefs.forEach(r=>tx.update(r,{status:'AVAILABLE',currentOrderId:null,expectedReturnDate:null,laundryCompletedAt:now}));
    release?.();tx.set(job,{stage:'DONE',updatedAt:now},{merge:true});
    syncDebtIndex(tx,db(),{...order,status:newStatus,updatedAt:now});
   }else if(action==='AUTO_RESOLVE_CAMERA_LATE'){
    // Historical beta-3 returned camera orders can be settled automatically without entering a fee.
    if(order.status!=='RETURNED'||!order.cameraLateFeePending||!order.returnProof?.at)throw new ApiError(409,'Không có phí máy ảnh cũ cần tính lại.');
    const quotes=order.lines.map(l=>approvedLineQuote(l,l.startAt||order.handoverProof?.at||order.pickupAt!,order.returnProof!.at!));
    const newTotal=quotes.reduce((sum,q)=>sum+q.amount,0);
    const overtime=quotes.reduce((sum,q)=>sum+q.cameraLateFee,0);
    if(newTotal+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)<order.paid)throw new ApiError(409,'Số đã thu lớn hơn tổng tiền mới, cần Admin đối soát hoàn tiền.');
    const next={...order,total:newTotal,cameraOvertimeFeeTotal:overtime,cameraLateFeePending:false,cameraLatePendingItemIds:[],updatedAt:now};
    syncDebtIndex(tx,db(),next);
    tx.update(ref,{total:newTotal,cameraOvertimeFeeTotal:overtime,cameraLateFeePending:false,cameraLatePendingItemIds:[],updatedAt:now,history:[...order.history,{action:'CAMERA_OVERTIME_AUTO_SETTLED',by:me.uid,at:now,amount:overtime,detail:`Tính tự động 10.000đ mỗi giờ trễ bắt đầu; tiền trễ nằm trong tổng thuê, không cộng lateFeeTotal lần nữa`}]});
   }else if(action==='PAY'){
    if(order.cameraLateFeePending)throw new ApiError(409,'Đơn máy ảnh cũ chưa đối soát tự động; Admin bấm Tính lại phí máy ảnh trước khi thu.');
    const amount=Number(b.amount||0);if(!Number.isSafeInteger(amount)||amount<=0||amount>100_000_000)throw new ApiError(400,'Số tiền thu phải lớn hơn 0.');
    const method=String(b.method||'CASH');
    if(!['CASH','TRANSFER'].includes(method))throw new ApiError(400,'Chọn thanh toán tiền mặt hoặc chuyển khoản.');
    const reference=String(b.reference||'').trim().slice(0,100);
    if(method==='TRANSFER'&&reference.length<4)throw new ApiError(400,'Chuyển khoản cần mã giao dịch hoặc nội dung đối chiếu.');
    const requestId=String(b.requestId||'');
    if(!/^[a-f0-9-]{36}$/.test(requestId))throw new ApiError(400,'Phiên thu tiền không hợp lệ. Vui lòng thử lại.');
    const movement=ref.collection('cashMovements').doc(requestId);
    const previously=await tx.get(movement);
    if(previously.exists){
     if(previously.data()?.kind!=='PAYMENT'||previously.data()?.actorUid!==me.uid||previously.data()?.amount!==amount||previously.data()?.method!==method||previously.data()?.reference!==reference)
      throw new ApiError(409,'Mã thu tiền đã dùng cho giao dịch khác.');
     return;
    }
    const allowed=order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-(order.paid||0);
    if(amount>allowed)throw new ApiError(409,'Số tiền thu vượt số còn phải thu.');
    const revised={...order,paid:order.paid+amount,updatedAt:now};syncDebtIndex(tx,db(),revised);
    tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(amount),payments:FieldValue.increment(1),updatedAt:now},{merge:true});
    tx.create(movement,{orderId:id,kind:'PAYMENT',amount,method,reference,actorUid:me.uid,actorName:me.name,createdAt:now,description:'Thu tiền đơn v5, chống ghi trùng bằng requestId'});
    tx.update(ref,{paid:order.paid+amount,updatedAt:now,history:[...order.history,{action:'PAY',by:me.uid,at:now,amount,detail:`Đã nhận tiền qua ${method} (${reference||'tiền mặt'})`}]});
   }else if(action==='ADD_ITEMS'){
    if(!order.pickupAt||!order.returnAt||order.returnStage==='AWAITING_ADMIN'||order.pendingExtraItemIds?.length)throw new ApiError(409,'Đơn đang chờ chụp bổ sung hoặc nhận trả.');
    const ids=b.itemIds;
    if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(x=>typeof x!=='string'||!simpleId(x))||new Set(ids).size!==ids.length||ids.some(x=>order.lines.some(l=>l.itemId===x)))throw new ApiError(400,'Chọn các sản phẩm mới hợp lệ, không trùng đơn.');
    const refs=(ids as string[]).map(x=>db().collection('items').doc(x));
    const snaps=await Promise.all(refs.map(r=>tx.get(r)));
    if(snaps.some(s=>!s.exists||s.data()?.archivedAt||s.data()?.status!=='AVAILABLE'))throw new ApiError(409,'Có sản phẩm bổ sung chưa sẵn sàng.');
    if(snaps.some(s=>!Array.isArray(s.data()?.inspectionAngles)||!s.data()?.inspectionAngles.length))throw new ApiError(409,'Admin phải cấu hình góc chụp cho sản phẩm bổ sung trước khi giao.');
    const existingGroup=orderGroup(order);
    if(existingGroup==='LEGACY_MIXED')throw new ApiError(409,'Đơn cũ đang có đồ hỗn hợp; không thể thêm món. Hãy tạo đơn mới theo từng nhóm.');
    if(!itemsBelongToGroup(snaps.map(s=>String(s.data()?.category||'')),existingGroup))throw new ApiError(409,'Không thể thêm máy ảnh vào đơn trang phục hoặc ngược lại. Hãy tạo đơn riêng.');
    const start=order.status==='RESERVED'?order.pickupAt:now;
    if(Date.parse(start)>=Date.parse(order.returnAt))throw new ApiError(409,'Đã qua giờ trả dự kiến. Cần gia hạn trước.');
    const slots=intervalRefs(ids,start,order.returnAt);
    const prior=await checkIntervalAvailability(tx,slots);
    const cameraTier=existingGroup==='CAMERA'?order.lines.find(l=>isCameraCategory(l.category||''))?.cameraPackageHours:undefined;
    const extra=snaps.map(s=>{const i={id:s.id,...s.data()} as InventoryItem;billableBlocks(start,order.returnAt!);
      let pkg={};if(isCameraCategory(i.category)){
        if(!isCameraModel(i.cameraModel))throw new ApiError(409,'Máy ảnh chưa có mẫu máy hợp lệ.');
        try{pkg=cameraTier?chosenCameraPackageSnapshot(i.cameraModel,start,order.returnAt!,cameraTier):cameraPackageSnapshot(i.cameraModel,start,order.returnAt!);}
        catch(e){throw new ApiError(400,e instanceof Error?e.message:'Gói thuê bổ sung không hợp lệ.');}
      }
      return {itemId:i.id,name:i.name,sku:i.sku,hangerCode:i.hangerCode,size:i.size,category:i.category,cameraModel:i.cameraModel,cameraSerial:i.cameraSerial,...pkg,dailyRate:i.dailyRate,bufferDays:0,replacementValue:i.replacementValue,startAt:start,startDate:vnDayKey(start),lineTotal:rentalCharge({...i,...pkg},start,order.returnAt!)};});
    const nextLines=[...order.lines,...extra];const total=nextLines.reduce((sum,l)=>sum+l.lineTotal,0);
    const topup=order.bookingKind==='RESERVE'&&order.status==='RESERVED'?Math.max(0,total-order.paid):0;
    let paidAfter=order.paid;
    if(topup>0){
      const paymentMethod=String(b.paymentMethod||'CASH');const paymentReference=String(b.paymentReference||'').trim().slice(0,100);
      if(!['CASH','TRANSFER'].includes(paymentMethod)||(paymentMethod==='TRANSFER'&&paymentReference.length<4))throw new ApiError(400,'Thiếu phương thức/mã đối soát thanh toán bổ sung.');
      if(b.confirmPaid!==true||Number(b.expectedTopup)!==topup)throw new ApiError(409,`Đơn đặt trước cần thu thêm ${topup.toLocaleString('vi-VN')}đ. Xem lại báo giá rồi xác nhận.`);
      const proof=await readVerifiedEvidence(tx,String(b.paymentProofId||''),me.uid,'reservation',String(b.paymentDraftId||''));
      tx.update(proof.ref,{consumedOrderId:id,consumedAt:now});
      tx.create(ref.collection('cashMovements').doc(String(b.paymentProofId)),{orderId:id,kind:'PAYMENT',amount:topup,method:paymentMethod,reference:paymentReference||String(b.paymentProofId),actorUid:me.uid,actorName:me.name,createdAt:now,description:'Thu tiền bổ sung khi thêm đồ vào đơn đặt trước'});
      tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(topup),payments:FieldValue.increment(1),updatedAt:now},{merge:true});
      paidAfter+=topup;
    }
    createIntervalWrites(tx,slots,prior,id);
    const pending=order.status==='PICKED_UP'?[...ids]:[];
    tx.update(ref,{lines:nextLines,total,bookedRentTotal:order.bookingKind==='RESERVE'?total:order.bookedRentTotal||order.total,paid:paidAfter,prepaidRentTotal:order.bookingKind==='RESERVE'&&order.status==='RESERVED'?paidAfter:order.prepaidRentTotal||0,pendingExtraItemIds:pending,referencePhotos:{...order.referencePhotos,...Object.fromEntries(snaps.map(s=>[s.id,s.data()?.referenceShots||{}]))},photoTemplates:{...requiredTemplates(order),...Object.fromEntries(snaps.map(s=>[s.id,(s.data()?.inspectionAngles as string[]|undefined)||[]]))},updatedAt:now,history:[...order.history,{action:'ADD_ITEMS',at:now,by:me.uid,detail:`Thêm ${ids.length} món; ${pending.length?'chờ chụp ảnh giao':'chờ chụp ảnh khi giao đơn'}`} ]});
    if(pending.length)tx.set(job,{stage:'HANDOVER',updatedAt:now},{merge:true});
    syncDebtIndex(tx,db(),{...order,lines:nextLines,total,paid:paidAfter,updatedAt:now});
   }else if(action==='EXTEND'){
    if(!order.pickupAt||!order.returnAt||order.returnStage==='AWAITING_ADMIN')throw new ApiError(409,'Không thể gia hạn khi chờ nhận đồ.');
    const candidate=String(b.returnAt||'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(candidate))throw new ApiError(400,'Chọn giờ trả mới.');
    const next=new Date(candidate+':00+07:00').toISOString();if(Date.parse(next)<=Date.parse(order.returnAt))throw new ApiError(400,'Giờ trả mới phải muộn hơn giờ cũ.');
    const blocks=billableBlocks(order.handoverProof?.at||order.pickupAt,next);
    const more=intervalRefs(order.lines.map(l=>l.itemId),order.returnAt,next);
    const prior=await checkIntervalAvailability(tx,more,id);
    const itemSnaps=await Promise.all(itemRefs.map(r=>tx.get(r)));
    const lines=order.lines.map((l,i)=>({...l,lineTotal:rentalCharge(l,l.startAt||order.pickupAt!,next)}));
    const total=lines.reduce((sum,l)=>sum+l.lineTotal,0);
    const topup=order.bookingKind==='RESERVE'&&order.status==='RESERVED'?Math.max(0,total-order.paid):0;
    let paidAfter=order.paid;
    if(topup>0){
      const paymentMethod=String(b.paymentMethod||'CASH');const paymentReference=String(b.paymentReference||'').trim().slice(0,100);
      if(!['CASH','TRANSFER'].includes(paymentMethod)||(paymentMethod==='TRANSFER'&&paymentReference.length<4))throw new ApiError(400,'Thiếu phương thức/mã đối soát thanh toán bổ sung.');
      if(b.confirmPaid!==true||Number(b.expectedTopup)!==topup)throw new ApiError(409,`Gia hạn cần thu thêm ${topup.toLocaleString('vi-VN')}đ. Kiểm tra lại giá thuê.`);
      const proof=await readVerifiedEvidence(tx,String(b.paymentProofId||''),me.uid,'reservation',String(b.paymentDraftId||''));
      tx.update(proof.ref,{consumedOrderId:id,consumedAt:now});
      tx.create(ref.collection('cashMovements').doc(String(b.paymentProofId)),{orderId:id,kind:'PAYMENT',amount:topup,method:paymentMethod,reference:paymentReference||String(b.paymentProofId),actorUid:me.uid,actorName:me.name,createdAt:now,description:'Thu bổ sung 100% khi gia hạn đơn đặt trước'});
      tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(topup),payments:FieldValue.increment(1),updatedAt:now},{merge:true});
      paidAfter+=topup;
    }
    createIntervalWrites(tx,more,prior,id);
    tx.update(ref,{returnAt:next,returnDate:vnDayKey(next),rentalDays:blocks,lines,total,bookedRentTotal:order.bookingKind==='RESERVE'?total:order.bookedRentTotal||order.total,paid:paidAfter,prepaidRentTotal:order.bookingKind==='RESERVE'&&order.status==='RESERVED'?paidAfter:order.prepaidRentTotal||0,updatedAt:now,history:[...order.history,{action:'EXTEND',at:now,by:me.uid,amount:total-order.total,detail:'Gia hạn theo chu kỳ 24 giờ'}]});
    tx.set(job,{returnAt:next,updatedAt:now},{merge:true});syncDebtIndex(tx,db(),{...order,returnAt:next,returnDate:vnDayKey(next),rentalDays:blocks,lines,total,paid:paidAfter,updatedAt:now});
   }
   auditInTransaction(tx,me,'V5_'+action,'order',id,`${order.code} / ${me.name}`);
  });
  if(['REVIEW_PHOTOS','APPROVE_RETURN','FINALIZE_LEGACY_RETURN','CANCEL','VOID'].includes(action)){
    // Durable job is saved in Firestore; this runs after the HTTP response, and Cron retries failures.
    after(async()=>{try{await Promise.all([runEvidenceCleanup(8),runSensitiveEvidenceCleanup(8)]);}catch(error){console.error('Deferred evidence cleanup',error);}});
  }
  return NextResponse.json({ok:true});
 }catch(e){return handleError(e,'PATCH /api/v5/orders/[id]');}
}
