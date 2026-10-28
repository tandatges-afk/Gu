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
import {pickupForDisplay,wasHandedOverEarly} from '@/lib/order-pickup-presentation';
import {GuVNDateTimeInput} from './GuVNDateTimeInput';
import {paymentReview} from '@/lib/payment-review';
import {GuOrderPaymentPanel} from './GuOrderPaymentPanel';
import {GuPrepaidAdjustment} from './GuPrepaidAdjustment';
import {rentalCharge} from '@/lib/camera-rental';
import {cameraLateAlert,cameraLiveQuote} from '@/lib/camera-live-status';
import {localDateTimeToISO} from '@/lib/hourly-pricing';
import {handoverLabel,collateralReturnQuote,collateralForLines,CLOTHING_SETTLEMENT_VERSION} from '@/lib/clothing-collateral';
import {CAMERA_SETTLEMENT_VERSION,cameraCollateralQuote,cameraCollateralForLines} from '@/lib/camera-collateral';
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
 useEffect(()=>{const term=addQuery.trim();if(!term){setAddResults([]);return;}let disposed=false;const timer=setTimeout(()=>{void api<{results:InventoryItem[]}>('catalog?kind=items&size=50&q='+encodeURIComponent(term)).then(r=>{if(!disposed)setAddResults(r.results);}).catch(()=>{if(!disposed)setAddResults([]);});},300);return()=>{disposed=true;clearTimeout(timer);};},[addQuery,api]);
 const [refundMethod,setRefundMethod]=useState<'CASH'|'TRANSFER'>('CASH');const [refundReference,setRefundReference]=useState('');
 const [cameraClock,setCameraClock]=useState(()=>Date.now());
 useEffect(()=>{if(orderGroup(order)!=='CAMERA'||order.status!=='PICKED_UP')return;const interval=setInterval(()=>setCameraClock(Date.now()),30_000);return()=>clearInterval(interval);},[order.id,order.status]);
 const [movements,setMovements]=useState<Array<{id:string;kind:string;amount:number;method?:string;reference?:string;actorName?:string;createdAt:string}>>([]);
 const pendingAction=useRef<{fingerprint:string;requestId:string}|null>(null);
 const [liveItems,setLiveItems]=useState<InventoryItem[]|null>(null);
 useEffect(()=>{let live=true;setLiveItems(null);if(order.status!=='RESERVED')return;void api<{items:InventoryItem[]}>('v5/orders/'+order.id).then(r=>{if(live)setLiveItems(r.items);}).catch(()=>{});return()=>{live=false;};},[api,order.id,order.updatedAt,order.status]);
 useEffect(()=>{if(!isAdmin)return;let mounted=true;void api<{payments:typeof movements}>('v5/orders/'+order.id).then(res=>{if(mounted)setMovements(res.payments);}).catch(()=>{});return()=>{mounted=false;};},[isAdmin,api,order.id,order.paid,order.refundTotal]);
 const cameraAlert=cameraLateAlert(order,cameraClock);
 const liveCameraQuote=cameraAlert?cameraLiveQuote(order,cameraClock):null;
 const displayedRent=liveCameraQuote?.total??order.total;
 const due=Math.max(0,order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid);
 const heldCashCredit=(order.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION||order.settlementPolicyVersion===CAMERA_SETTLEMENT_VERSION)&&!order.collateralReturnedAt?(order.handoverCashCollateralAmount||0):0;
 const extraCashNeeded=Math.max(0,(liveCameraQuote?.unpaid??due)-heldCashCredit);
 const refund=Math.max(0,order.paid-order.total-(order.compensationTotal||0)-(order.otherFeeTotal||0)-(order.lateFeeTotal||0));
 const clothingPolicy=order.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION&&orderGroup(order)==='CLOTHING';
 const cameraOrder=orderGroup(order)==='CAMERA';
 const cameraPolicy=cameraOrder&&order.settlementPolicyVersion===CAMERA_SETTLEMENT_VERSION;
 const notClean=order.status==='RESERVED'?order.lines.filter(line=>{const item=(liveItems||items).find(i=>i.id===line.itemId);return !item||item.status!=='AVAILABLE';}):[];
 const unavailableReasons=notClean.map(line=>{const state=(liveItems||items).find(i=>i.id===line.itemId)?.status;return `${line.name}: ${state==='RENTED'?'đang cho khách khác thuê':state==='LAUNDRY'?'đang giặt':state==='MAINTENANCE'?'đang bảo trì':state==='MISSING'?'thất lạc':'chưa sẵn sàng'}`;});
 const collateralQuote=(clothingPolicy||cameraPolicy)&&order.status==='RETURNED'&&(['CASH','CCCD'] as string[]).includes(order.handoverDepositKind||'')?(cameraPolicy?cameraCollateralQuote:collateralReturnQuote)({kind:order.handoverDepositKind as 'CASH'|'CCCD',security:order.handoverCashCollateralAmount||0,rent:order.total,extras:(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0),paidRent:order.paid}):null;
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
 const act=async(action:string,extra:Record<string,unknown>={})=>{
  if(busy)return;
  const fingerprint=order.id+':'+action+':'+JSON.stringify(extra);
  if(pendingAction.current?.fingerprint!==fingerprint)pendingAction.current={fingerprint,requestId:crypto.randomUUID()};
  const requestId=pendingAction.current.requestId;
  setBusy(true);setError('');
  try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action,...extra,requestId})});await onChanged();pendingAction.current=null;}
  catch(e){setError(e instanceof Error?e.message:'Không thể lưu đơn.');}
  finally{setBusy(false);}
 };
 return <div className="modal-body detail-body gu-order-compact">
 <header className="gu-order-title"><div><h3>{order.code} · {order.customerName}</h3><p>Mã sản phẩm: {order.lines.map(l=>(l.hangerCode||l.sku)+(l.cameraSerial?' · Serial '+l.cameraSerial:'')).join(', ')}</p></div><span className="gu-order-status">{order.status==='RESERVED'?'Chờ giao':order.status==='PICKED_UP'?'Đang thuê':order.status==='RETURNED'?'Đã trả':order.status==='CANCELLED'?'Đã hủy':'Đã đóng'}</span></header>
 <div className="gu-pickup-summary" aria-label="Thời gian nhận và trả sản phẩm"><div><span>{order.handoverProof?.at?'Khách đã nhận lúc':'Giờ hẹn nhận'}</span><strong>{pickupForDisplay(order)?formatVNDateTime(pickupForDisplay(order)!):order.pickupDate}</strong>{wasHandedOverEarly(order)&&<small className="gu-early-pickup">Nhận sớm hơn lịch hẹn</small>}</div><div><span>Giờ trả dự kiến</span><strong>{order.returnAt?formatVNDateTime(order.returnAt):order.returnDate}</strong></div></div>
 {cameraAlert&&<div role="status" className="gu-camera-live-alert"><strong>Máy ảnh trả trễ {cameraAlert.lateMinutes} phút</strong><span>{liveCameraQuote?`Tổng thuê tạm tính ${money(displayedRent)} · Bao gồm phí trễ ${money(liveCameraQuote.lateFee)} · Còn dự kiến ${money(liveCameraQuote.unpaid)}.`:'Chưa tính được phí trễ tạm tính. Nhân viên cần nhận trả để chốt tiền.'} Phí chính thức được ghi nhận khi nhận trả.</span></div>}
 <div className="gu-quick-money"><span><small>{cameraAlert?'Tạm tính đến lúc này':'Tổng thuê'}</small><strong>{money(displayedRent)}</strong></span><span><small>Đã thu</small><strong>{money(order.paid)}</strong></span><span><small>{clothingPolicy?'Thu thêm sau cấn trừ':'Còn thiếu'}</small><strong>{cameraOrder&&order.status==='PICKED_UP'?'Chờ trả máy':money(extraCashNeeded)}</strong></span></div>
 {existingGroup==='LEGACY_MIXED'&&<p className="inline-alert">Đơn dữ liệu cũ chứa máy ảnh và trang phục chung. Vẫn xem và xử lý trả hàng bình thường, nhưng không được thêm sản phẩm mới. Hãy tạo hai đơn riêng nếu khách tiếp tục thuê.</p>}
 {clothingPolicy&&order.status==='RESERVED'&&<p className="gu-mini-note">Khi giao: cọc tài sản {money(order.collateralRequiredAmount||collateralForLines(order.lines))} hoặc CCCD có ảnh.</p>}{cameraOrder&&order.status==='RESERVED'&&<p className="gu-mini-note">Máy ảnh: cọc {money(cameraPolicy?order.collateralRequiredAmount||cameraCollateralForLines(order.lines):0)} hoặc CCCD, chụp chứng từ khi giao. {cameraPolicy?'Thuê trực tiếp khấu trừ tiền thuê khi trả; đặt trước chỉ khấu trừ phí phát sinh.':'Đơn cũ giữ cách đối soát thủ công.'}</p>}
 {order.returnStage==='AWAITING_ADMIN'&&<div className="inline-alert danger-alert">Đơn dữ liệu cũ đang chờ duyệt. Nhân viên có thể hoàn tất nhận trả mà không đợi Admin.{order.status==='PICKED_UP'&&<button type="button" className="btn btn-white" disabled={busy} onClick={()=>void act('FINALIZE_LEGACY_RETURN')}>Hoàn tất nhận trả đơn cũ</button>}</div>}
 {order.cameraLateFeePending&&<p className="inline-alert danger-alert">Máy ảnh chưa đối soát phí trễ, Admin cần tính lại trước khi thu.</p>}
 {notClean.length>0&&<p className="inline-alert danger-alert">Chưa thể bàn giao: {unavailableReasons.join('; ')}. Chỉ giao khi kho báo còn trống.</p>}{['RESERVED','PICKED_UP'].includes(order.status)&&order.returnStage!=='AWAITING_ADMIN'&&<button type="button" className="btn btn-dark gu-v11-capture-button" disabled={busy||notClean.length>0} onClick={onCapture}>{notClean.length?'Sản phẩm chưa sẵn sàng':order.status==='RESERVED'?'Bàn giao · Chụp ảnh và cọc':order.pendingExtraItemIds?.length?'Giao thêm đồ':'Nhận trả · Quyết toán'}</button>}
 {cameraAlert&&order.status==='PICKED_UP'&&<p className="gu-mini-note">Máy ảnh đang quá giờ: hãy bấm “Nhận trả · Quyết toán” trước khi thu tiền để ghi nhận đúng số giờ trễ. Không thu theo giá cũ.</p>}
 {!order.cameraLateFeePending&&!cameraAlert&&extraCashNeeded>0&&(!clothingPolicy||order.status==='RETURNED')&&(!cameraOrder||order.status==='RETURNED')&&<GuOrderPaymentPanel order={order} api={api} onPaid={onChanged}/>}
 {order.status==='RETURNED'&&(order.handoverDepositProofId||order.hadHandoverDeposit)&&!order.collateralReturnedAt&&<div className="inline-alert danger-alert">{collateralQuote?<><strong>{collateralQuote.returnId?'Trả CCCD':'Hoàn '+money(collateralQuote.refund)+' tiền cọc'}</strong> · Tổng thuê {money(order.total)} · Đã thu thuê {money(order.paid)} · Bù trừ tiền thuê/phụ phí: {money(collateralQuote.applied)} · {collateralQuote.collect>0?'Cần thu thêm '+money(collateralQuote.collect):'Đã đủ điều kiện quyết toán'}.</>:cameraOrder?'Thu tiền thuê đầy đủ, sau đó trả cọc/CCCD theo đối soát của cửa hàng.':'Chưa xác nhận hoàn vật cọc.'}<button type="button" className="btn btn-white" disabled={busy||Boolean(collateralQuote?.collect)||(cameraOrder&&!cameraPolicy&&due>0)} onClick={()=>{if(confirm(cameraOrder?'Bạn xác nhận đã đối soát và trả vật cọc/CCCD máy ảnh theo quy định cửa hàng?':'Bạn đã trực tiếp hoàn đúng số tiền cọc hoặc trả CCCD cho khách?'))void act('RETURN_COLLATERAL',{confirmReturned:true});}}>Xác nhận hoàn cọc / CCCD</button></div>}
 {isAdmin&&!clothingPolicy&&order.status==='RETURNED'&&refund>0&&<div className="gu-v5-payment-review"><h4>Đã thu thừa: {money(refund)}</h4><p>Thực hiện hoàn tiền ngoài hệ thống, sau đó mới xác nhận để ghi vào sổ quỹ.</p><select className="input" value={refundMethod} onChange={e=>setRefundMethod(e.target.value as 'CASH'|'TRANSFER')}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>{refundMethod==='TRANSFER'&&<input className="input" placeholder="Mã giao dịch / nội dung hoàn tiền" value={refundReference} onChange={e=>setRefundReference(e.target.value)}/>}<button className="btn btn-white" disabled={busy||refundMethod==='TRANSFER'&&refundReference.trim().length<4} onClick={()=>{if(confirm(`Bạn xác nhận ĐÃ HOÀN ${money(refund)} cho khách?`))void act('REFUND_RETURN',{confirmRefund:true,method:refundMethod,reference:refundReference});}}>Ghi nhận đã hoàn đủ</button></div>}
 {error&&<div className="inline-alert danger-alert">{error}</div>}
 <details className="gu-order-more"><summary><span>Thông tin & thao tác khác</span><small>Chứng từ, giờ hẹn gốc, gia hạn, thêm sản phẩm, lịch sử</small></summary><div className="gu-order-more-body">
 {order.status!=='RESERVED'&&<details className="gu-optional-details gu-pickup-audit"><summary>Xem giờ hẹn ban đầu và giờ tính tiền</summary><p>Giờ hẹn ban đầu: <b>{order.scheduledPickupAt||order.pickupAt?formatVNDateTime(order.scheduledPickupAt||order.pickupAt!):order.pickupDate}</b></p>{order.lines[0]?.startAt&&<p>Bắt đầu tính tiền thuê: <b>{formatVNDateTime(order.lines[0].startAt)}</b></p>}</details>}
 {cameraOrder&&<p className="gu-mini-note">Giá gói máy ảnh: {money(order.lines.reduce((s,l)=>s+(l.cameraPackageBasePrice??l.lineTotal??0),0))}{order.cameraOvertimeFeeTotal?` · Phí trễ đã chốt: ${money(order.cameraOvertimeFeeTotal)}`:''}. Phí trả trễ chưa chốt chỉ là tạm tính.</p>}
 <p className="gu-compact-meta">{order.status==='RESERVED'?'Chưa giao':order.status==='PICKED_UP'?'Đã giao · Đang thuê':order.status==='RETURNED'?'Đã nhận trả':order.status==='CANCELLED'?'Đã hủy':'Đơn đã đóng'} · Giao: {handoverLabel(order)} · Nhận: {order.returnProof?.byName||'Chưa nhận'}</p><details className="gu-optional-details"><summary>Nhân viên và các khoản gia hạn</summary><p>Nhân viên tạo: {order.createdByName||'—'}{extensionAdded>0&&<> · Phí gia hạn đã tính vào tổng: {money(extensionAdded)}</>}</p></details>
 {order.bookingKind==='RESERVE'&&<p className="gu-mini-note">Đặt trước: {money(order.prepaidRentTotal||0)} đã được tính trong “Đã thu”, không thu lần hai.</p>}
 {order.reservationPaymentProofId&&<details><summary>Ảnh chứng từ đã thu tiền thuê</summary><GuSecurePhoto id={order.reservationPaymentProofId} alt="Ảnh tiền thuê đặt trước"/></details>}
 {(order.handoverDepositProofId||order.hadHandoverDeposit)&&<details className="gu-optional-details"><summary>Bảo đảm đã giữ: {order.handoverDepositKind==='CASH'?(cameraOrder?(cameraPolicy?money(order.handoverCashCollateralAmount||0):'Tiền cọc (đơn cũ)'):money(order.handoverCashCollateralAmount||0)):order.handoverDepositKind||'Khác'}</summary><p>{cameraOrder&&!cameraPolicy?'Máy ảnh đơn cũ: đối soát cọc thủ công.':'Khi trả: chỉ trừ tiền thuê/phụ phí chưa thanh toán từ cọc tiền; nếu giữ CCCD thì phải thu đủ trước khi trả.'}</p>{order.handoverDepositProofId?<GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc khi giao"/>:<small>Ảnh vật cọc đã được xóa sau hậu kiểm.</small>}</details>}
 {order.photoReviewStatus==='PENDING'&&<p className="inline-alert">Ảnh đang chờ Admin hậu kiểm. Hàng đã được hoàn kho/giặt, không bị khóa.</p>}
 {order.sensitiveEvidenceStatus==='DELETING'&&<p className="inline-alert">Chứng từ CCCD/vật cọc/thanh toán đang chờ tác vụ xóa sau thời hạn 5 ngày. Hệ thống sẽ tự thử lại nếu gặp lỗi.</p>}
 {order.sensitiveEvidenceStatus==='PURGED'&&<p className="inline-alert">Đã xóa chứng từ nhạy cảm khỏi kho ảnh hoạt động. Lịch sử đơn và tối đa 7 lượt ảnh kiểm nhận đã duyệt vẫn được giữ.</p>}
 {isAdmin&&order.status==='RESERVED'&&order.bookingKind==='RESERVE'&&<p className="gu-mini-note">Khách bỏ lịch: tiền thuê đã thu {money(order.paid)} không hoàn. Admin hủy sẽ giải phóng lịch giữ và giữ nguyên sổ thu.</p>}
 {isAdmin&&<details className="gu-cash-ledger"><summary>Chi tiết thu / hoàn tiền (100 giao dịch gần nhất)</summary>{movements.map(m=><p key={m.id}><b>{m.kind==='COLLATERAL_IN'?'Nhận cọc tài sản':m.kind==='COLLATERAL_REFUND'?'Hoàn tiền cọc':m.kind==='COLLATERAL_APPLIED'?'Cấn trừ cọc vào thuê':m.kind==='REFUND'?'Hoàn tiền thuê':m.kind==='RESERVATION_FORFEITED'?'Tiền giữ lịch không hoàn':'Thu tiền thuê'}: {money(m.amount)}</b> · {m.method||'Chưa phân loại'} · {m.actorName||'Nhân viên'} · {formatVNDateTime(m.createdAt)}</p>)}</details>}
 {isAdmin&&order.status==='RESERVED'&&<button className="btn btn-white" disabled={busy||(order.paid>0&&order.bookingKind!=='RESERVE')} onClick={()=>{if(confirm(order.paid>0?`Hủy lịch và KHÔNG HOÀN ${money(order.paid)} đã thu? Thao tác giải phóng sản phẩm, giữ nguyên sổ thu.`:'Hủy lịch chưa giao và giải phóng ngày giữ?'))void act('CANCEL');}}>Hủy lịch {order.paid>0?'· Giữ tiền đặt trước':'chưa giao'}</button>}
 {isAdmin&&order.cameraLateFeePending&&<button className="btn btn-white" disabled={busy} onClick={()=>void act('AUTO_RESOLVE_CAMERA_LATE')}>Tính lại phí trễ máy ảnh</button>}
 {['RESERVED','PICKED_UP'].includes(order.status)&&<details className="gu-optional-details"><summary>Gia hạn giờ trả</summary><div className="gu-v5-photo-actions"><label>Gia hạn đến giờ<GuVNDateTimeInput value={extension} onChange={setExtension} ariaLabel="Gia hạn đến giờ"/></label>{reservedTopup?<GuPrepaidAdjustment key={'extension-'+extension} label="Gia hạn theo giờ" hideMethod={clothingPolicy} amount={extension?extendTopup:null} busy={busy} onConfirm={payment=>void act('EXTEND',{returnAt:extension,...payment})}/>:<button className="btn btn-white" disabled={busy||!extension} onClick={()=>void act('EXTEND',{returnAt:extension})}>Gia hạn theo giờ</button>}</div></details>}
 {['RESERVED','PICKED_UP'].includes(order.status)&&!order.pendingExtraItemIds?.length&&existingGroup!=='LEGACY_MIXED'&&<section className="gu-v5-add-items"><button type="button" className="btn btn-white" onClick={()=>setAddOpen(v=>!v)}>Thêm sản phẩm vào đơn</button>{addOpen&&<><input className="input" placeholder="Tìm sản phẩm" value={addQuery} onChange={e=>setAddQuery(e.target.value)}/><div className="gu-v5-product-select">{[...items,...addResults].filter((i,index,all)=>!i.archivedAt&&allowAdd(i)&&!order.lines.some(l=>l.itemId===i.id)&&all.findIndex(y=>y.id===i.id)===index&&matchesProductSearch(i.name+' '+(i.hangerCode||'')+' '+i.category,addQuery)).slice(0,50).map(i=><button key={i.id} type="button" className={'gu-v5-product '+(extra.includes(i.id)?'gu-v5-selected':'')} onClick={()=>setExtra(v=>v.includes(i.id)?v.filter(x=>x!==i.id):[...v,i.id])}><ProductImage paths={i.imagePaths}/><span><b>{i.name}</b><small>{i.hangerCode||i.sku}</small></span><strong>{extra.includes(i.id)?'✓ Đã chọn':'Chọn'}</strong></button>)}</div>{reservedTopup?<GuPrepaidAdjustment key={'add-'+extra.join(',')} label={'Thêm '+extra.length+' món'} hideMethod={clothingPolicy} amount={extra.length?addTopup:null} busy={busy} onConfirm={payment=>void act('ADD_ITEMS',{itemIds:extra,...payment})}/>:<button type="button" className="btn btn-dark" disabled={busy||!extra.length} onClick={()=>void act('ADD_ITEMS',{itemIds:extra})}>Xác nhận thêm {extra.length} món</button>}</>}</section>}
 {isAdmin&&['RESERVED','PICKED_UP','RETURNED'].includes(order.status)&&<button className="btn btn-danger" disabled={busy||order.paid>0} onClick={()=>{if(confirm('Chỉ xóa khi đã nhận đủ đồ sạch. Xác nhận?'))void act('VOID',{confirmCleanItems:true});}}>Admin xóa đơn & hoàn kho sạch</button>}
 </div></details>
 </div>;
}
