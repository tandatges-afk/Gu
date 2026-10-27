'use client';
import {useEffect,useRef,useState} from 'react';
import type {RentalOrder,InventoryItem} from '@/lib/types';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuMoneyInput} from './GuMoneyInput';
import {GuSecurePhoto} from './GuSecurePhoto';
import {money} from '@/lib/rental';
import {matchesProductSearch} from '@/lib/product-search';
import {isCameraCategory,isCameraModel,chosenCameraPackageSnapshot} from '@/lib/camera-rental';
import {orderGroup,productGroup} from '@/lib/order-group';
import {formatVNDateTime} from '@/lib/vn-datetime';
import {GuVNDateTimeInput} from './GuVNDateTimeInput';
import {paymentReview} from '@/lib/payment-review';
import {GuOrderPaymentPanel} from './GuOrderPaymentPanel';
import {GuPrepaidAdjustment} from './GuPrepaidAdjustment';
import {rentalCharge} from '@/lib/camera-rental';
import {localDateTimeToISO} from '@/lib/hourly-pricing';
import {handoverLabel,collateralReturnQuote,collateralForLines,CLOTHING_SETTLEMENT_VERSION} from '@/lib/clothing-collateral';
export function GuV5Review({api,onChanged,active=true}:{api:ApiCall;onChanged:()=>Promise<void>;active?:boolean}){
 const [jobs,setJobs]=useState<Array<{orderId:string;code:string;customerName:string}>>([]);
 const [order,setOrder]=useState<RentalOrder|null>(null);const [items,setItems]=useState<InventoryItem[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [note,setNote]=useState('');const lastLoaded=useRef(0);
 const reload=async()=>{try{const r=await api<{jobs:typeof jobs}>('v5/jobs?stage=REVIEW');setJobs(r.jobs);lastLoaded.current=Date.now();}catch(e){setError(e instanceof Error?e.message:'Không tải được ảnh chờ xem.');}};
 useEffect(()=>{if(active&&Date.now()-lastLoaded.current>60_000)void reload();},[active]);
 const open=async(id:string)=>{try{const r=await api<{order:RentalOrder;items:InventoryItem[]}>('v5/orders/'+id);setOrder(r.order);setItems(r.items);}catch(e){setError(e instanceof Error?e.message:'Không mở được đơn.');}};
 const done=async()=>{
  if(!order||!confirm('Duyệt ảnh giao/nhận và lên lịch xóa vĩnh viễn ảnh CCCD, vật cọc, chứng từ sau 5 ngày kể từ lúc hoàn tất đơn? Chỉ giữ 7 lượt ảnh góc chụp đã duyệt của mỗi món.'))return;
  setBusy(true);setError('');try{
   await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'REVIEW_PHOTOS'})});
   setOrder(null);await reload();await onChanged();setNote('Đã duyệt ảnh. Chứng từ nhạy cảm sẽ được xóa sau 5 ngày từ khi hoàn tất đơn và đã hoàn cọc/CCCD.');
  }catch(e){setError(e instanceof Error?e.message:'Không cập nhật được.');}finally{setBusy(false);}
 };
 return <section className="gu-v5-review">
  <div className="page-intro"><div><div className="eyebrow">ADMIN · HẬU KIỂM</div><h1>Kiểm tra ảnh giao / nhận</h1></div><button className="btn btn-white" onClick={()=>void reload()}>Tải lại</button></div>
  {error&&<p className="field-error">{error}</p>}{note&&<p className="inline-alert">{note}</p>}
  <div className="gu-v5-review-layout"><aside className="gu-v5-review-list"><h3>Chưa kiểm tra ({jobs.length})</h3>{jobs.map(j=><button key={j.orderId} className="gu-v5-job" onClick={()=>void open(j.orderId)}><b>{j.code}</b><span>{j.customerName}</span></button>)}{!jobs.length&&<p>Không có ảnh nhận trả đang chờ hậu kiểm.</p>}</aside>
  {order&&<article className="panel gu-v5-review-detail"><h2>{order.code} · {order.customerName}</h2><p><b>Nhân viên tạo:</b> {order.createdByName||'—'} · <b>Giao:</b> {order.handoverProof?.byName||'—'} · <b>Nhận:</b> {order.returnProof?.byName||'—'}</p><p><b>Trạng thái:</b> {order.status==='RETURNED'?'Đã nhận trả, kho không bị khóa':'Đơn cũ đang chờ hoàn tất thủ tục'}</p>
   {order.reservationPaymentProofId&&<section className="gu-v52-deposit-panel"><strong>Ảnh thu đủ tiền đặt lịch</strong><GuSecurePhoto id={order.reservationPaymentProofId} alt="Chứng từ thanh toán đặt trước"/></section>}
   {order.handoverDepositProofId&&<section className="gu-v52-deposit-panel"><strong>Ảnh vật cọc khi giao ({order.handoverDepositKind||'Không rõ'})</strong><GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc khi bàn giao"/></section>}
   {order.lines.map(line=><section className="gu-v5-inspection-item" key={line.itemId}><h3>{line.name} · {line.hangerCode||line.sku}{line.cameraSerial?' · Serial '+line.cameraSerial:''}</h3><p>Tình trạng trả: <b>{order.returnProof?.items.find(p=>p.itemId===line.itemId)?.condition||'OK'}</b> {order.returnProof?.items.find(p=>p.itemId===line.itemId)?.note||''}</p><ProductImage paths={items.find(i=>i.id===line.itemId)?.imagePaths}/>
    {(order.photoTemplates?.[line.itemId]||[]).map(angle=><div className="gu-v5-angle" key={angle}><strong>{angle}</strong><div className="gu-v5-compare"><div><small>Khi giao</small>{order.handoverProof?.items.find(p=>p.itemId===line.itemId)?.shots[angle]?.url?<img src={order.handoverProof.items.find(p=>p.itemId===line.itemId)?.shots[angle].url} alt={'Giao '+angle}/>:<p>Không có ảnh</p>}</div><div><small>Khi trả</small>{order.returnProof?.items.find(p=>p.itemId===line.itemId)?.shots[angle]?.url?<img src={order.returnProof.items.find(p=>p.itemId===line.itemId)?.shots[angle].url} alt={'Trả '+angle}/>:<p>Không có ảnh</p>}</div></div></div>)}
   </section>)}
   <div className="gu-v5-payment-review"><p>{paymentReview(order).extra>0?<><strong>Tổng thuê:</strong> {money(paymentReview(order).rent)} · <strong>Phụ thu/đền bù:</strong> {money(paymentReview(order).extra)} · </>:null}<strong>Đã thu:</strong> {money(order.paid)}</p>
    {paymentReview(order).overpaid>0&&<p className="gu-payment-warning">Số đã thu cao hơn tổng tiền ghi nhận {money(paymentReview(order).overpaid)}. Đây không tự động được xem là phụ thu; Admin cần đối soát và ghi hoàn tiền nếu thực sự thu thừa.</p>}
    {order.photoReviewStatus==='PENDING'?<button className="btn btn-dark" disabled={busy} onClick={()=>void done()}>Đã xem ảnh · Hoàn tất hậu kiểm</button>:order.returnStage==='AWAITING_ADMIN'?<p className="inline-alert">Đơn được tạo trước bản nâng cấp. Nhân viên cần sử dụng thao tác hoàn tất đơn cũ để nhận trả; không cần chờ kiểm tra ảnh.</p>:<p>Ảnh đã được kiểm tra.</p>}
   </div>
  </article>}</div>
 </section>;
}
export function GuV5OrderDetail({order,items,api,onChanged,isAdmin,onCapture}:{order:RentalOrder;items:InventoryItem[];api:ApiCall;onChanged:()=>Promise<void>;isAdmin:boolean;onCapture:()=>void}){
 const [addOpen,setAddOpen]=useState(false);const [addQuery,setAddQuery]=useState('');const [extra,setExtra]=useState<string[]>([]);const [addResults,setAddResults]=useState<InventoryItem[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [pay,setPay]=useState('');const [extension,setExtension]=useState('');
 const [refundMethod,setRefundMethod]=useState<'CASH'|'TRANSFER'>('CASH');const [refundReference,setRefundReference]=useState('');
 const [movements,setMovements]=useState<Array<{id:string;kind:string;amount:number;method?:string;reference?:string;actorName?:string;createdAt:string}>>([]);
 useEffect(()=>{if(!isAdmin)return;let mounted=true;void api<{payments:typeof movements}>('v5/orders/'+order.id).then(res=>{if(mounted)setMovements(res.payments);}).catch(()=>{});return()=>{mounted=false;};},[isAdmin,api,order.id,order.paid,order.refundTotal]);
 const due=Math.max(0,order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid);
 const heldCashCredit=order.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION&&!order.collateralReturnedAt?(order.handoverCashCollateralAmount||0):0;
 const extraCashNeeded=Math.max(0,due-heldCashCredit);
 const refund=Math.max(0,order.paid-order.total-(order.compensationTotal||0)-(order.otherFeeTotal||0)-(order.lateFeeTotal||0));
 const clothingPolicy=order.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION&&orderGroup(order)==='CLOTHING';
 const collateralQuote=clothingPolicy&&order.status==='RETURNED'&&(['CASH','CCCD'] as string[]).includes(order.handoverDepositKind||'')?collateralReturnQuote({kind:order.handoverDepositKind as 'CASH'|'CCCD',security:order.handoverCashCollateralAmount||0,rent:order.total,extras:(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0),paidRent:order.paid}):null;
 const reservedTopup=order.bookingKind==='RESERVE'&&order.status==='RESERVED';
 const existingGroup=orderGroup(order);
 const allowAdd=(item:InventoryItem)=>existingGroup!=='LEGACY_MIXED'&&productGroup(item.category)===existingGroup;
 const addCandidate=[...items,...addResults].filter((i,index,all)=>extra.includes(i.id)&&allowAdd(i)&&all.findIndex(x=>x.id===i.id)===index);
 const addTopup=reservedTopup?(()=>{try{
   if(addCandidate.length!==extra.length||!order.pickupAt||!order.returnAt)return null;
   const pkgHours=existingGroup==='CAMERA'?order.lines.find(l=>isCameraCategory(l.category||''))?.cameraPackageHours:undefined;
   const extraRent=addCandidate.reduce((s,i)=>{const pkg=isCameraCategory(i.category)&&pkgHours&&isCameraModel(i.cameraModel)?chosenCameraPackageSnapshot(i.cameraModel,order.pickupAt!,order.returnAt!,pkgHours):{};return s+rentalCharge({...i,...pkg},order.pickupAt!,order.returnAt!);},0);
   return Math.max(0,order.total+extraRent-order.paid);
 }catch{return null;}})():0;
 const extensionAdded=order.history.filter(entry=>entry.action==='EXTEND').reduce((total,entry)=>total+Math.max(0,Number(entry.amount)||0),0);
 const extendTopup=reservedTopup?(()=>{try{
   if(!extension||!order.pickupAt)return null;
   const nextTime=localDateTimeToISO(extension);
   const quote=order.lines.reduce((sum,line)=>sum+rentalCharge(line,line.startAt||order.pickupAt!,nextTime),0);
   return Math.max(0,quote-order.paid);
 }catch{return null;}})():0;
 const act=async(action:string,extra:Record<string,unknown>={})=>{if(busy)return;setBusy(true);setError('');try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action,...extra})});await onChanged();}catch(e){setError(e instanceof Error?e.message:'Không thể lưu đơn.');}finally{setBusy(false);}};
 return <div className="modal-body detail-body"><h3>{order.code} · {order.customerName}</h3><p>Mã sản phẩm: {order.lines.map(l=>(l.hangerCode||l.sku)+(l.cameraSerial?' · Serial '+l.cameraSerial:'')).join(', ')}</p>
 <p>Giờ giao: <b>{order.pickupAt?formatVNDateTime(order.pickupAt):order.pickupDate}</b> · Giờ trả dự kiến: <b>{order.returnAt?formatVNDateTime(order.returnAt):order.returnDate}</b></p>
 <p>Giá thuê sau gia hạn: <b>{money(order.total)}</b> {extensionAdded>0&&<span>· Phí gia hạn đã cộng vào giá: <b>{money(extensionAdded)}</b></span>} · Đã thu tiền thuê: <b>{money(order.paid)}</b> · {clothingPolicy&&heldCashCredit>0?'Cần thu thêm sau khấu trừ cọc':'Còn phải thu'}: <b>{money(extraCashNeeded)}</b></p>
 <p>Nhân viên tạo: {order.createdByName||'—'} · Giao: {handoverLabel(order)} · Nhận: {order.returnProof?.byName||'Chưa nhận'}</p>
 {existingGroup==='LEGACY_MIXED'&&<p className="inline-alert">Đơn dữ liệu cũ chứa máy ảnh và trang phục chung. Vẫn xem và xử lý trả hàng bình thường, nhưng không được thêm sản phẩm mới. Hãy tạo hai đơn riêng nếu khách tiếp tục thuê.</p>}
 {clothingPolicy&&order.status==='RESERVED'&&<p className="inline-alert"><strong>Khi khách tới lấy:</strong> cần nhận {money(order.collateralRequiredAmount||collateralForLines(order.lines))} tiền cọc tài sản, hoặc giữ CCCD có ảnh chứng từ. Đây không phải tiền thuê.</p>}
 {clothingPolicy&&extensionAdded>0&&<p className="inline-alert">Gia hạn đã tăng tổng tiền thuê thêm <b>{money(extensionAdded)}</b>. Nếu khách đã trả tiền thuê ban đầu, chỉ thu hoặc khấu trừ phần còn thiếu khi hoàn vật cọc, không thu lại từ đầu.</p>}
 {order.bookingKind==='RESERVE'&&<p className="inline-alert">Đặt lịch trước: đã thu trước tiền thuê {money(order.prepaidRentTotal||0)}. Khi khách đến nhận vẫn phải giữ tiền cọc tài sản hoặc CCCD; tiền này không được tính là tiền thuê lần hai.</p>}
 {order.reservationPaymentProofId&&<details><summary>Ảnh chứng từ đã thu tiền thuê</summary><GuSecurePhoto id={order.reservationPaymentProofId} alt="Ảnh tiền thuê đặt trước"/></details>}
 {(order.handoverDepositProofId||order.hadHandoverDeposit)&&<details open={order.status==='PICKED_UP'}><summary>Bảo đảm khi giao: {order.handoverDepositKind==='CASH'?money(order.handoverCashCollateralAmount||0):order.handoverDepositKind||'Khác'}</summary><p>Khi trả: tiền cọc được khấu trừ phần thuê/phụ phí chưa thanh toán, phần còn lại hoàn khách; CCCD chỉ trả sau khi đã thu đủ tiền thuê.</p>{order.handoverDepositProofId?<GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc khi giao"/>:<small>Ảnh vật cọc đã được xóa sau hậu kiểm.</small>}</details>}
 {order.status==='RETURNED'&&(order.handoverDepositProofId||order.hadHandoverDeposit)&&!order.collateralReturnedAt&&<div className="inline-alert danger-alert">{collateralQuote?<><strong>{collateralQuote.returnId?'Trả CCCD':'Hoàn '+money(collateralQuote.refund)+' tiền cọc'}</strong> · Tổng thuê {money(order.total)} · Đã thu thuê {money(order.paid)} · Bù trừ tiền thuê/phụ phí: {money(collateralQuote.applied)} · {collateralQuote.collect>0?'Cần thu thêm '+money(collateralQuote.collect):'Đã đủ điều kiện quyết toán'}.</>:'Chưa xác nhận hoàn vật cọc.'}<button type="button" className="btn btn-white" disabled={busy||Boolean(collateralQuote?.collect)} onClick={()=>{if(confirm('Bạn đã trực tiếp hoàn đúng số tiền cọc hoặc trả CCCD cho khách?'))void act('RETURN_COLLATERAL',{confirmReturned:true});}}>Xác nhận hoàn cọc / CCCD</button></div>}
 {order.photoReviewStatus==='PENDING'&&<p className="inline-alert">Ảnh đang chờ Admin hậu kiểm. Hàng đã được hoàn kho/giặt, không bị khóa.</p>}
 {order.sensitiveEvidenceStatus==='DELETING'&&<p className="inline-alert">Chứng từ CCCD/vật cọc/thanh toán đang chờ tác vụ xóa sau thời hạn 5 ngày. Hệ thống sẽ tự thử lại nếu gặp lỗi.</p>}
 {order.sensitiveEvidenceStatus==='PURGED'&&<p className="inline-alert">Đã xóa chứng từ nhạy cảm khỏi kho ảnh hoạt động. Lịch sử đơn và tối đa 7 lượt ảnh kiểm nhận đã duyệt vẫn được giữ.</p>}
 {order.returnStage==='AWAITING_ADMIN'&&<div className="inline-alert danger-alert">Đơn dữ liệu cũ đang chờ duyệt. Nhân viên có thể hoàn tất nhận trả mà không đợi Admin.{order.status==='PICKED_UP'&&<button type="button" className="btn btn-white" disabled={busy} onClick={()=>void act('FINALIZE_LEGACY_RETURN')}>Hoàn tất nhận trả đơn cũ</button>}</div>}
 {['RESERVED','PICKED_UP'].includes(order.status)&&order.returnStage!=='AWAITING_ADMIN'&&<button type="button" className="btn btn-dark gu-v11-capture-button" onClick={onCapture}>{order.status==='RESERVED'?'Chụp ảnh giao và vật cọc':order.pendingExtraItemIds?.length?'Chụp ảnh giao thêm':'Chụp ảnh nhận trả · thanh toán'}</button>}
 {order.cameraLateFeePending&&<p className="inline-alert danger-alert">Máy ảnh chưa đối soát phí trễ, Admin cần tính lại trước khi thu.</p>}
 {!order.cameraLateFeePending&&(!clothingPolicy||order.status==='RETURNED')&&<GuOrderPaymentPanel order={order} api={api} onPaid={onChanged}/>}
 {isAdmin&&order.status==='RESERVED'&&order.paid>0&&<div className="gu-v5-payment-review"><h4>Hủy lịch đã đặt cọc tiền thuê</h4><p>Đã thu trước {money(order.paid)}. Trước khi hủy phải hoàn đủ tiền cho khách ngoài hệ thống rồi ghi nhận.</p><select className="input" value={refundMethod} onChange={e=>setRefundMethod(e.target.value as 'CASH'|'TRANSFER')}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>{refundMethod==='TRANSFER'&&<input className="input" placeholder="Mã chuyển khoản" value={refundReference} onChange={e=>setRefundReference(e.target.value)}/>}<button className="btn btn-white" disabled={busy||refundMethod==='TRANSFER'&&refundReference.trim().length<4} onClick={()=>{if(confirm(`Bạn xác nhận ĐÃ HOÀN ${money(order.paid)} cho khách trước khi hủy?`))void act('REFUND_RESERVATION',{confirmRefund:true,method:refundMethod,reference:refundReference});}}>Đã hoàn tiền để hủy lịch</button></div>}
 {isAdmin&&!clothingPolicy&&order.status==='RETURNED'&&refund>0&&<div className="gu-v5-payment-review"><h4>Đã thu thừa: {money(refund)}</h4><p>Thực hiện hoàn tiền ngoài hệ thống, sau đó mới xác nhận để ghi vào sổ quỹ.</p><select className="input" value={refundMethod} onChange={e=>setRefundMethod(e.target.value as 'CASH'|'TRANSFER')}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>{refundMethod==='TRANSFER'&&<input className="input" placeholder="Mã giao dịch / nội dung hoàn tiền" value={refundReference} onChange={e=>setRefundReference(e.target.value)}/>}<button className="btn btn-white" disabled={busy||refundMethod==='TRANSFER'&&refundReference.trim().length<4} onClick={()=>{if(confirm(`Bạn xác nhận ĐÃ HOÀN ${money(refund)} cho khách?`))void act('REFUND_RETURN',{confirmRefund:true,method:refundMethod,reference:refundReference});}}>Ghi nhận đã hoàn đủ</button></div>}
 {isAdmin&&<details className="gu-cash-ledger"><summary>Chi tiết thu / hoàn tiền (100 giao dịch gần nhất)</summary>{movements.map(m=><p key={m.id}><b>{m.kind==='COLLATERAL_IN'?'Nhận cọc tài sản':m.kind==='COLLATERAL_REFUND'?'Hoàn tiền cọc':m.kind==='COLLATERAL_APPLIED'?'Cấn trừ cọc vào thuê':m.kind==='REFUND'?'Hoàn tiền thuê':'Thu tiền thuê'}: {money(m.amount)}</b> · {m.method||'Chưa phân loại'} · {m.actorName||'Nhân viên'} · {formatVNDateTime(m.createdAt)}</p>)}</details>}
 {error&&<div className="inline-alert danger-alert">{error}</div>}
 {isAdmin&&order.status==='RESERVED'&&<button className="btn btn-white" disabled={busy||order.paid>0} onClick={()=>{if(confirm('Hủy lịch chưa giao?'))void act('CANCEL');}}>Hủy lịch chưa giao (chỉ khi không có tiền cần hoàn)</button>}
 {isAdmin&&order.cameraLateFeePending&&<button className="btn btn-white" disabled={busy} onClick={()=>void act('AUTO_RESOLVE_CAMERA_LATE')}>Tính lại phí trễ máy ảnh</button>}
 {['RESERVED','PICKED_UP'].includes(order.status)&&<div className="gu-v5-photo-actions"><label>Gia hạn đến giờ<GuVNDateTimeInput value={extension} onChange={setExtension} ariaLabel="Gia hạn đến giờ"/></label>{reservedTopup?<GuPrepaidAdjustment key={'extension-'+extension} label="Gia hạn theo giờ" hideMethod={clothingPolicy} amount={extension?extendTopup:null} busy={busy} onConfirm={payment=>void act('EXTEND',{returnAt:extension,...payment})}/>:<button className="btn btn-white" disabled={busy||!extension} onClick={()=>void act('EXTEND',{returnAt:extension})}>Gia hạn theo giờ</button>}</div>}
 {['RESERVED','PICKED_UP'].includes(order.status)&&!order.pendingExtraItemIds?.length&&existingGroup!=='LEGACY_MIXED'&&<section className="gu-v5-add-items"><button type="button" className="btn btn-white" onClick={()=>setAddOpen(v=>!v)}>Thêm sản phẩm vào đơn</button>{addOpen&&<><input className="input" placeholder="Tìm sản phẩm" value={addQuery} onChange={e=>{setAddQuery(e.target.value);if(e.target.value.trim())void api<{results:InventoryItem[]}>('catalog?kind=items&size=50&q='+encodeURIComponent(e.target.value.trim())).then(r=>setAddResults(r.results)).catch(()=>{});}}/><div className="gu-v5-product-select">{[...items,...addResults].filter((i,index,all)=>!i.archivedAt&&allowAdd(i)&&!order.lines.some(l=>l.itemId===i.id)&&all.findIndex(y=>y.id===i.id)===index&&matchesProductSearch(i.name+' '+(i.hangerCode||'')+' '+i.category,addQuery)).slice(0,50).map(i=><button key={i.id} type="button" className={'gu-v5-product '+(extra.includes(i.id)?'gu-v5-selected':'')} onClick={()=>setExtra(v=>v.includes(i.id)?v.filter(x=>x!==i.id):[...v,i.id])}><ProductImage paths={i.imagePaths}/><span><b>{i.name}</b><small>{i.hangerCode||i.sku}</small></span><strong>{extra.includes(i.id)?'✓ Đã chọn':'Chọn'}</strong></button>)}</div>{reservedTopup?<GuPrepaidAdjustment key={'add-'+extra.join(',')} label={'Thêm '+extra.length+' món'} hideMethod={clothingPolicy} amount={extra.length?addTopup:null} busy={busy} onConfirm={payment=>void act('ADD_ITEMS',{itemIds:extra,...payment})}/>:<button type="button" className="btn btn-dark" disabled={busy||!extra.length} onClick={()=>void act('ADD_ITEMS',{itemIds:extra})}>Xác nhận thêm {extra.length} món</button>}</>}</section>}
 {isAdmin&&['RESERVED','PICKED_UP','RETURNED'].includes(order.status)&&<button className="btn btn-danger" disabled={busy||order.paid>0} onClick={()=>{if(confirm('Chỉ xóa khi đã nhận đủ đồ sạch. Xác nhận?'))void act('VOID',{confirmCleanItems:true});}}>Admin xóa đơn & hoàn kho sạch</button>}
 </div>;
}
