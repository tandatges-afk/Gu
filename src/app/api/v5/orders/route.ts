import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError,requirePcStaff} from '@/lib/http';
import {localDateTimeToISO,billableBlocks,vnDayKey} from '@/lib/hourly-pricing';
import {rentalCharge,chosenCameraPackageSnapshot,isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import {itemsBelongToGroup,type RentalGroup} from '@/lib/order-group';
import {collateralForLines,CLOTHING_SETTLEMENT_VERSION} from '@/lib/clothing-collateral';
import {CAMERA_SETTLEMENT_VERSION,cameraCollateralForLines} from '@/lib/camera-collateral';
import {intervalRefs,checkIntervalAvailability,createIntervalWrites,simpleId} from '@/lib/v5-server';
import {normalizedAngles} from '@/lib/inspection-proof';
import {auditInTransaction} from '@/lib/audit';
import {FieldValue} from '@/lib/pg-firestore';
import {requiresFullPrepayment} from '@/lib/gu-v52-workflow';
import {readVerifiedEvidence} from '@/lib/secure-evidence';
import {assertText,normalizePhone} from '@/lib/rental';
import type {RentalOrder,InventoryItem,Customer,RentalLine} from '@/lib/types';
export const runtime='nodejs';export const preferredRegion='sin1';
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requirePcStaff(me);
  const b=await jsonBody(req);
  const quick=b.quickCustomer&&typeof b.quickCustomer==='object'&&!Array.isArray(b.quickCustomer)?b.quickCustomer as Record<string,unknown>:null;
  const quickName=quick?assertText(quick.name,'Tên khách',100):'';
  const quickPhone=quick?normalizePhone(quick.phone):'';
  if(!quick&&!simpleId(String(b.customerId||'')))throw new ApiError(400,'Chọn khách hàng hợp lệ.');

  const group=b.rentalGroup as RentalGroup;
  if(group!=='CAMERA'&&group!=='CLOTHING')throw new ApiError(400,'Chọn loại đơn: Thuê máy ảnh hoặc Thuê trang phục/phụ kiện.');
  const ids=b.itemIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(x=>typeof x!=='string'||!simpleId(x))||new Set(ids).size!==ids.length)throw new ApiError(400,'Chọn từ 1 đến 12 sản phẩm không trùng nhau.');
  const pickupAt=localDateTimeToISO(String(b.pickupAt||''));const returnAt=localDateTimeToISO(String(b.returnAt||''));
  const blocks=billableBlocks(pickupAt,returnAt);
  if(Date.parse(pickupAt)<Date.now()-5*60_000)throw new ApiError(400,'Không tạo lịch nhận trong quá khứ.');
  if(Date.parse(pickupAt)>Date.now()+365*86_400_000)throw new ApiError(400,'Chỉ đặt lịch trong 365 ngày tới.');
  const note=typeof b.note==='string'?b.note.slice(0,500):'';
  // Prepare phone-index & legacy lookups BEFORE the transaction; the decisive
  // phone-index lock is read and claimed atomically INSIDE the transaction.
  const phoneRef=quick?db().collection('phoneIndex').doc(encodeURIComponent(quickPhone)):null;
  const legacyMatches=quick?await Promise.all([quickPhone,'+84'+quickPhone.slice(1),'84'+quickPhone.slice(1)].map(phone=>db().collection('customers').where('phone','==',phone).limit(1).get())):[];
  const legacyId=legacyMatches.flatMap(snap=>snap.docs.map(doc=>doc.id))[0]||null;
  // Firestore .doc() may create a new ID, but .doc(undefined) is invalid.
  // Keep the historical matching customer where possible; otherwise generate
  // a new document reference now, so a failed order transaction creates no customer.
  const customersCollection=db().collection('customers');
  const customerRef=quick
    ? (legacyId?customersCollection.doc(legacyId):customersCollection.doc())
    : customersCollection.doc(String(b.customerId));

  const itemRefs=(ids as string[]).map(x=>db().collection('items').doc(x));
  const orderRef=db().collection('orders').doc();const jobRef=db().collection('mobileJobs').doc(orderRef.id);
  const slots=intervalRefs(ids as string[],pickupAt,returnAt);
  const now=new Date().toISOString();
  const prepay=requiresFullPrepayment(pickupAt,now,b.bookingKind==='RESERVE');
  const paymentProofId=String(b.reservationPaymentProofId||'');
  const paymentDraftId=String(b.paymentDraftId||'');
  // Optional for old clients; the Fix20 UI always submits a stable UUID.
  const requestId=String(b.createRequestId||'');
  if(requestId&&!/^[a-f0-9-]{36}$/.test(requestId))throw new ApiError(400,'Mã lần tạo đơn không hợp lệ.');
  const requestRef=requestId?db().collection('orderCreateRequests').doc(me.uid+'_'+requestId):null;
  const fingerprint=createHash('sha256').update(JSON.stringify({
    group,ids,customerId:quick?null:String(b.customerId),quick:quick?{name:quickName,phone:quickPhone}:null,
    pickupAt,returnAt,note,bookingKind:b.bookingKind,paymentProofId,paymentDraftId,cameraPackageHours:b.cameraPackageHours
  })).digest('hex');
  if(prepay&&!paymentProofId)throw new ApiError(400,'Đặt lịch trước phải thu đủ 100% tiền thuê và chụp ảnh thanh toán.');
  const result=await db().runTransaction(async tx=>{
   // Read the idempotency record under the same PostgreSQL transaction lock as
   // availability, cash journal and order creation. A retry returns the SAME order.
   if(requestRef){
    const prior=await tx.get(requestRef);
    if(prior.exists){
     if(prior.data()?.fingerprint!==fingerprint)throw new ApiError(409,'Đã dùng mã tạo đơn với nội dung khác. Đóng và mở lại cửa sổ tạo đơn.');
     const previousOrder=await tx.get(db().collection('orders').doc(String(prior.data()?.orderId||'')));
     if(!previousOrder.exists)throw new ApiError(409,'Mã tạo đơn đã dùng nhưng thiếu đơn tham chiếu. Liên hệ Admin.');
     return {id:previousOrder.id,...previousOrder.data()} as RentalOrder;
    }
   }
   const [indexedCustomer,...itemSnaps]=await Promise.all([phoneRef?tx.get(phoneRef):Promise.resolve(null),...itemRefs.map(x=>tx.get(x))]);
   const indexedCustomerId=phoneRef&&indexedCustomer?.exists?String(indexedCustomer.data()?.customerId||''):'';
   if(indexedCustomer?.exists&&!simpleId(indexedCustomerId))throw new ApiError(409,'Chỉ mục khách hàng bị thiếu thông tin. Liên hệ Admin để kiểm tra.');
   const resolvedCustomerRef=indexedCustomerId?customersCollection.doc(indexedCustomerId):customerRef;
   const customerSnap=await tx.get(resolvedCustomerRef);
   if((!quick&&!customerSnap.exists)||(phoneRef&&indexedCustomer?.exists&&!customerSnap.exists)||itemSnaps.some(x=>!x.exists))throw new ApiError(404,'Không tìm thấy khách hoặc sản phẩm.');
   const customer:Customer=customerSnap.exists?{id:customerSnap.id,...customerSnap.data()} as Customer:
    {id:resolvedCustomerRef.id,name:quickName,phone:quickPhone,note:'',createdAt:now};

   const items=itemSnaps.map(s=>({id:s.id,...s.data()} as InventoryItem));
   if(items.some(i=>i.archivedAt||['MAINTENANCE','MISSING'].includes(i.status)))throw new ApiError(409,'Có sản phẩm đã ngưng sử dụng hoặc thất lạc.');
   if(items.some(i=>!Array.isArray(i.inspectionAngles)||!i.inspectionAngles.length))throw new ApiError(409,'Admin cần thêm góc ảnh giao/nhận cho từng sản phẩm trước khi tạo đơn.');
   if(!itemsBelongToGroup(items.map(i=>i.category),group))throw new ApiError(409,'Đơn máy ảnh và đơn trang phục/phụ kiện phải tạo riêng. Không thể chọn đồ khác nhóm.');
   const cameraItems=items.filter(i=>isCameraCategory(i.category));
   if(cameraItems.length&&(!cameraItems.every(i=>isCameraModel(i.cameraModel))))throw new ApiError(409,'Máy ảnh chưa được Admin cấu hình đúng mẫu máy.');
   let chosenCamera:ReturnType<typeof chosenCameraPackageSnapshot>|null=null;
   if(cameraItems.length){
    try{chosenCamera=chosenCameraPackageSnapshot(cameraItems[0].cameraModel!,pickupAt,returnAt,b.cameraPackageHours);}catch(e){throw new ApiError(400,e instanceof Error?e.message:'Gói máy ảnh không hợp lệ.');}
   }
   const snapshots=await checkIntervalAvailability(tx,slots);
   const paymentEvidence=prepay?await readVerifiedEvidence(tx,paymentProofId,me.uid,'reservation',paymentDraftId):null;
   const lines:RentalLine[]=items.map(i=>{
    const cameraSnapshot=isCameraCategory(i.category)&&chosenCamera&&isCameraModel(i.cameraModel)?chosenCameraPackageSnapshot(i.cameraModel,pickupAt,returnAt,b.cameraPackageHours):{};
    return {itemId:i.id,name:i.name,sku:i.sku,hangerCode:i.hangerCode,size:i.size,category:i.category,cameraModel:i.cameraModel,cameraSerial:i.cameraSerial,...cameraSnapshot,dailyRate:i.dailyRate,bufferDays:0,replacementValue:i.replacementValue,lineTotal:rentalCharge({...i,...cameraSnapshot},pickupAt,returnAt),startDate:vnDayKey(pickupAt),startAt:pickupAt};
   });
   const total=lines.reduce((s,l)=>s+l.lineTotal,0);
   const code='TH-'+now.slice(2,10).replace(/-/g,'')+'-'+orderRef.id.slice(0,12).toUpperCase();
   // Snapshot only validated/normalized angle labels. InventoryItem.inspectionAngles is optional
   // for legacy records, but a new v5 order must persist a complete string[] per item.
   const photoTemplates:Record<string,string[]>={};
   for(const item of items){
    try{photoTemplates[item.id]=normalizedAngles(item.inspectionAngles);}
    catch{throw new ApiError(409,`Góc chụp của sản phẩm “${item.name}” không hợp lệ. Admin cần kiểm tra lại.`);}
   }
   const referencePhotos=Object.fromEntries(items.map(i=>[i.id,i.referenceShots||{}]));
   const record:Omit<RentalOrder,'id'>={code,rentalGroup:group,...(group==='CLOTHING'?{settlementPolicyVersion:CLOTHING_SETTLEMENT_VERSION,collateralRequiredAmount:collateralForLines(lines)}:{settlementPolicyVersion:CAMERA_SETTLEMENT_VERSION,collateralRequiredAmount:cameraCollateralForLines(lines)}),customerId:customer.id,customerName:customer.name,customerPhone:customer.phone,pickupDate:vnDayKey(pickupAt),returnDate:vnDayKey(returnAt),pickupAt,returnAt,pricingVersion:'GU_HOURLY_V1',photoTemplates,referencePhotos,rentalDays:blocks,lines,total,paid:prepay?total:0,depositDue:0,bookingKind:prepay?'RESERVE':'WALK_IN',bookedRentTotal:total,prepaidRentTotal:prepay?total:0,...(prepay?{reservationPaymentProofId:paymentProofId}:{}),note,status:'RESERVED',createdAt:now,updatedAt:now,createdBy:me.uid,createdByName:me.name,history:[{action:'CREATE_HOURLY',at:now,by:me.uid,detail:'Đơn đã được tạo, chụp ảnh tại màn giao hàng của nhân viên'}]};
   // A failed rental does not leave an orphan customer. Concurrent quick creation
   // is serialized on phoneIndex even when two staff members click at once.
   if(quick&&!customerSnap.exists)tx.create(resolvedCustomerRef,{name:quickName,phone:quickPhone,note:'',createdAt:now});
   if(phoneRef&&!indexedCustomer?.exists)tx.create(phoneRef,{customerId:customer.id});
   tx.create(orderRef,record);if(requestRef)tx.create(requestRef,{orderId:orderRef.id,fingerprint,createdAt:now,by:me.uid});createIntervalWrites(tx,slots,snapshots,orderRef.id);

   if(paymentEvidence){
    tx.update(paymentEvidence.ref,{consumedOrderId:orderRef.id,consumedAt:now});
    tx.create(orderRef.collection('cashMovements').doc(),{orderId:orderRef.id,kind:'PAYMENT',amount:total,method:'PHOTO_PROOF',reference:'',actorUid:me.uid,actorName:me.name,createdAt:now,description:'Nhân viên lập đơn xác nhận đã thu đủ tiền qua ảnh cọc, không phân loại phương thức'});
    tx.set(db().collection('cashDaily').doc(vnDayKey(now)),{amount:FieldValue.increment(total),payments:FieldValue.increment(1),updatedAt:now},{merge:true});
   }
   tx.create(jobRef,{orderId:orderRef.id,code,customerName:customer.name,pickupAt,returnAt,stage:'HANDOVER',createdAt:now,updatedAt:now,creatorName:me.name});
   auditInTransaction(tx,me,'V5_ORDER_CREATE','order',orderRef.id,`${code} / ${items.length} sản phẩm, ${blocks} chu kỳ`);
   return {id:orderRef.id,...record};
  });
  return NextResponse.json(result,{status:201});
 }catch(e){return handleError(e,'POST /api/v5/orders');}
}
