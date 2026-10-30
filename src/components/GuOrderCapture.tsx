'use client';
import {uploadImageToApi} from '@/lib/upload-client';
import {useEffect,useMemo,useState} from 'react';
import {Camera,CheckCircle2,X,Wallet,ShieldCheck,PackageCheck,AlertTriangle,Search,ImagePlus} from 'lucide-react';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuSecureUpload} from './GuSecureUpload';
import {GuOrderPaymentPanel} from './GuOrderPaymentPanel';
import {GuSecurePhoto} from './GuSecurePhoto';
import {GuMoneyInput} from './GuMoneyInput';
import {money} from '@/lib/rental';
import {collateralForLines,collateralReturnQuote,CLOTHING_SETTLEMENT_VERSION} from '@/lib/clothing-collateral';
import {CAMERA_SETTLEMENT_VERSION,cameraCollateralQuote,cameraCollateralForLines} from '@/lib/camera-collateral';
import {orderGroup} from '@/lib/order-group';
import type {RentalOrder,InventoryItem} from '@/lib/types';
type Condition='OK'|'ISSUE'|'MISSING';
type Phase='HANDOVER'|'HANDOVER_EXTRA'|'RETURN'|null;
function phaseOf(order:RentalOrder):Phase{
 if(order.status==='RESERVED')return 'HANDOVER';
 if(order.status==='PICKED_UP'&&order.pendingExtraItemIds?.length)return 'HANDOVER_EXTRA';
 if(order.status==='PICKED_UP'&&order.returnStage!=='AWAITING_ADMIN')return 'RETURN';
 return null;
}
export function GuOrderCapture({orderId,api,onClose,onDone}:{orderId:string;api:ApiCall;onClose:()=>void;onDone:()=>Promise<void>}){
 const [order,setOrder]=useState<RentalOrder|null>(null);
 const [items,setItems]=useState<InventoryItem[]>([]);
 const [pictures,setPictures]=useState<Record<string,string>>({});
 const [conditions,setConditions]=useState<Record<string,Condition>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [sending,setSending]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [depositDraftId]=useState(()=>crypto.randomUUID());
 const [depositProofId,setDepositProofId]=useState('');
 const [depositKind,setDepositKind]=useState<'CCCD'|'CASH'|'OTHER'>('CCCD');
 const [settling,setSettling]=useState(false);
 const [surcharge,setSurcharge]=useState('');
 const [surchargeReason,setSurchargeReason]=useState('');
 useEffect(()=>{let live=true;setOrder(null);setPictures({});setConditions({});setNotes({});setError('');
  api<{order:RentalOrder;items:InventoryItem[]}>('v5/orders/'+orderId).then(result=>{if(live){setOrder(result.order);setItems(result.items);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Không lấy được đơn.');});
  return()=>{live=false;};
 },[orderId,api]);
 const phase=order?phaseOf(order):null;
 const clothingPolicy=Boolean(order?.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION&&orderGroup(order)==='CLOTHING');
 const cameraOrder=Boolean(order&&orderGroup(order)==='CAMERA');
 const cameraPolicy=Boolean(cameraOrder&&order?.settlementPolicyVersion===CAMERA_SETTLEMENT_VERSION);
 const waitingLaundry=Boolean(order&&phaseOf(order)==='HANDOVER'&&order.lines.some(line=>items.find(item=>item.id===line.itemId)?.status!=='AVAILABLE'));
 const waitingReason=order?.lines.filter(line=>items.find(item=>item.id===line.itemId)?.status!=='AVAILABLE')
   .map(line=>{const state=items.find(item=>item.id===line.itemId)?.status;return `${line.name}: ${state==='RENTED'?'đang có khách khác thuê':state==='LAUNDRY'?'đang giặt':state==='MAINTENANCE'?'đang bảo trì':state==='MISSING'?'thất lạc':'chưa sẵn sàng'}`;}).join('; ');
 const requiredSecurity=order?(clothingPolicy?collateralForLines(order.lines):cameraPolicy?cameraCollateralForLines(order.lines):0):0;
 const extraSecurity=(clothingPolicy||cameraPolicy)&&order?.handoverDepositKind==='CASH'&&phase==='HANDOVER_EXTRA'?(clothingPolicy?collateralForLines(order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId))):cameraCollateralForLines(order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId)))):0;
 const cashAmount=phase==='HANDOVER_EXTRA'?extraSecurity:depositKind==='CASH'&&(clothingPolicy||cameraPolicy)?requiredSecurity:0;
 const returnQuote=order&&(clothingPolicy||cameraPolicy)&&(['CASH','CCCD'] as string[]).includes(order.handoverDepositKind||'')?(cameraPolicy?cameraCollateralQuote:collateralReturnQuote)({kind:order.handoverDepositKind as 'CASH'|'CCCD',security:order.handoverCashCollateralAmount||0,rent:order.total,extras:(order.otherFeeTotal||0)+(order.compensationTotal||0)+(order.lateFeeTotal||0),paidRent:order.paid}):null;
 const due=order?Math.max(0,order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid):0;
 const lines=useMemo(()=>!order?[]:phase==='HANDOVER_EXTRA'?order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId)):order.lines,[order,phase]);
 const count=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).length),0);
 const completed=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).filter(angle=>Boolean(pictures[l.itemId+'|'+angle])).length),0);
 const missingSetup=lines.some(l=>!order?.photoTemplates?.[l.itemId]?.length);
 const missingReason=lines.some(l=>conditions[l.itemId]&&conditions[l.itemId]!=='OK'&&!notes[l.itemId]?.trim()&&!pictures[l.itemId+'|issue']);
 const canSend=Boolean(phase&&lines.length>0&&!missingSetup&&!missingReason&&count===completed&&!sending&&!busy&&(phase!=='HANDOVER'||Boolean(depositProofId))&& !waitingLaundry&&(!extraSecurity||Boolean(depositProofId)));
 const upload=async(file:File|null,itemId:string,angle:string)=>{
  if(!file||!order||!phase)return;
  const key=itemId+'|'+angle;setSending(key);setError('');
  try{
   const current=clientAuth().currentUser;if(!current)throw Error('Bạn chưa đăng nhập.');
   const resized=await preparePhonePhoto(file);
   const data=await uploadImageToApi('/api/uploads',resized,await current.getIdToken(),{purpose:phase==='RETURN'?'return':'handover',orderId:order.id});
   if(typeof data.path!=='string')throw Error('Phản hồi ảnh không hợp lệ.');
   setPictures(old=>({...old,[key]:data.path as string}));
  }catch(e){setError(e instanceof Error?e.message:'Không thể tải ảnh.');}finally{setSending(null);}
 };
 const submit=async()=>{
  if(!order||!phase||!canSend)return;setBusy(true);setError('');
  try{
   const proofs=lines.map(l=>({itemId:l.itemId,shots:Object.fromEntries((order.photoTemplates?.[l.itemId]||[]).map(angle=>[angle,pictures[l.itemId+'|'+angle]||''])),condition:conditions[l.itemId]||'OK',note:notes[l.itemId]||'',issuePhotoUrl:pictures[l.itemId+'|issue']||''}));
   await api('v5/orders/'+orderId,{method:'PATCH',body:JSON.stringify({action:phase==='HANDOVER'?'HANDOVER':phase==='HANDOVER_EXTRA'?'HANDOVER_EXTRA':'RECEIVE',items:proofs,...((phase==='HANDOVER'||phase==='HANDOVER_EXTRA')&&depositProofId?{depositProofId,depositDraftId,depositKind,collateralAmount:cashAmount}:{})})});
   const updated=await api<{order:RentalOrder}>('v5/orders/'+orderId);setOrder(updated.order);setPictures({});
   await onDone();if(phase==='RETURN'){setSettling(true);}else onClose();
  }catch(e){setError(e instanceof Error?e.message:'Không hoàn thành kiểm nhận.');}finally{setBusy(false);}
 };
 const confirmCollateral=async()=>{if(!order||returnQuote?.collect||!confirm(returnQuote?`Xác nhận đã ${returnQuote.returnId?'TRẢ CCCD':'HOÀN '+money(returnQuote.refund)+' CỌC'} trực tiếp cho khách?`:'Bạn đã TRẢ vật cọc trực tiếp cho khách?'))return;setBusy(true);setError('');try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'RETURN_COLLATERAL',confirmReturned:true})});onClose();void onDone().catch(error=>console.error('Đã xác nhận hoàn cọc nhưng không thể tải lại danh sách đơn',error));}catch(e){setError(e instanceof Error?e.message:'Không ghi nhận được vật cọc.');}finally{setBusy(false);}};
 const saveSurcharge=async(value:number,reason:string)=>{if(!order)return;setBusy(true);setError('');try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'APPLY_SURCHARGE',amount:value,reason})});const fresh=await api<{order:RentalOrder}>('v5/orders/'+order.id);setOrder(fresh.order);setSurcharge('');setSurchargeReason('');await onDone();}catch(e){setError(e instanceof Error?e.message:'Không thêm được phụ thu.');}finally{setBusy(false);}};
 return <div className="gu-capture-overlay" role="presentation"><section role="dialog" aria-modal="true" aria-label="Chụp ảnh giao nhận đơn" className="gu-capture-dialog">
  <header className="gu-capture-header"><div><span className="gu-capture-kicker">Ảnh kiểm nhận · PC & Điện thoại</span><h2>{settling?'Nhận trả · Quyết toán':phase==='RETURN'?'Nhận trả':phase==='HANDOVER_EXTRA'?'Giao thêm đồ':'Bàn giao sản phẩm'}</h2><p>{order?.code||'Đang tải đơn…'} · {order?.customerName||''}</p></div><button type="button" className="icon-btn" aria-label="Đóng kiểm nhận" onClick={onClose}><X/></button></header>
  {error&&<div role="alert" className="inline-alert danger-alert">{error}</div>}
  {waitingLaundry&&<p className="inline-alert danger-alert">{waitingReason||'Sản phẩm chưa sẵn sàng'}. Chỉ giao khi kho xác nhận còn trống.</p>}{order&&!phase&&!settling&&<div className="inline-alert">Đơn đã hoàn thành hoặc không còn ảnh cần chụp.</div>}
  {order&&phase&&<><div className="gu-capture-progress"><span>{completed}/{count} ảnh</span><progress max={Math.max(1,count)} value={completed}/></div>
   {lines.map(line=><article className="gu-capture-item" key={line.itemId}><div className="gu-capture-item-title"><ProductImage paths={items.find(i=>i.id===line.itemId)?.imagePaths}/><div><h3>{line.name}</h3><span>{line.hangerCode||line.sku}</span></div></div>
    <div className="gu-capture-conditions" role="group" aria-label={'Tình trạng '+line.name}>
      <div className="gu-capture-condition-actions">
       {(phase==='RETURN'?(['OK','ISSUE','MISSING'] as Condition[]):(['OK','ISSUE'] as Condition[])).map(c=><button type="button" key={c} className={'gu-condition-choice '+(conditions[line.itemId]===c?'chosen gu-condition-'+c.toLowerCase():'')} aria-pressed={conditions[line.itemId]===c} onClick={()=>setConditions(old=>({...old,[line.itemId]:c}))}>
        {c==='OK'?<CheckCircle2 size={16} aria-hidden="true"/>:c==='ISSUE'?<AlertTriangle size={16} aria-hidden="true"/>:<Search size={16} aria-hidden="true"/>}
        <span>{c==='OK'?'Bình thường':c==='ISSUE'?'Có vấn đề':'Thất lạc'}</span>
       </button>)}
      </div>
      {conditions[line.itemId]&&conditions[line.itemId]!=='OK'&&<div className={'gu-capture-issue'+(conditions[line.itemId]==='MISSING'?' is-missing':'')}>
       <div className="gu-capture-issue-heading"><span className="gu-capture-issue-icon"><AlertTriangle size={17} aria-hidden="true"/></span><div><strong>{conditions[line.itemId]==='MISSING'?'Ghi nhận tài sản thất lạc':'Ghi nhận tình trạng có vấn đề'}</strong><p>{conditions[line.itemId]==='MISSING'?'Chụp ảnh chứng từ liên quan hoặc ghi chú chi tiết tình trạng thất lạc.':'Chụp rõ vị trí bị lỗi; không cần gõ mô tả nếu đã có ảnh.'}</p></div></div>
       <div className="gu-capture-issue-evidence">
        {pictures[line.itemId+'|issue']&&<img src={pictures[line.itemId+'|issue']} alt={'Ảnh vấn đề '+line.name} className="gu-capture-issue-photo"/>}
        <label className={'gu-capture-issue-upload'+(pictures[line.itemId+'|issue']?' has-photo':'')+(sending===line.itemId+'|issue'||busy?' is-busy':'')}>
         <span className="gu-capture-issue-upload-icon"><ImagePlus size={19} aria-hidden="true"/></span>
         <span className="gu-capture-issue-upload-text"><strong>{sending===line.itemId+'|issue'?'Đang tải ảnh…':pictures[line.itemId+'|issue']?'Chụp lại ảnh':'Chụp ảnh vấn đề'}</strong><small>{pictures[line.itemId+'|issue']?'Đã có ảnh · nhấn để thay thế':'Mở camera hoặc chọn ảnh có sẵn'}</small></span>
         <input type="file" accept="image/*" capture="environment" disabled={Boolean(sending)||busy} aria-label={'Chụp ảnh vấn đề cho '+line.name} onChange={e=>{void upload(e.target.files?.[0]||null,line.itemId,'issue');e.target.value='';}}/>
        </label>
       </div>
       <label className="gu-capture-issue-note"><span>Ghi chú <small>{pictures[line.itemId+'|issue']?'(không bắt buộc)':'(nếu không thể chụp ảnh)'}</small></span><textarea className="input" rows={2} aria-label="Ghi chú tình trạng nếu không chụp ảnh" value={notes[line.itemId]||''} onChange={e=>setNotes(old=>({...old,[line.itemId]:e.target.value}))} placeholder="Vị trí, hiện trạng hoặc thông tin bổ sung…"/></label>
      </div>}</div>
    {!(phase==='RETURN'&&conditions[line.itemId]==='MISSING')&&(order.photoTemplates?.[line.itemId]||[]).map(angle=><div className="gu-capture-angle" key={angle}><b>{angle}</b><div className="gu-capture-photo-grid"><div><small>{phase==='RETURN'?'Ảnh khi giao':'Ảnh mẫu'}</small>{(()=>{const url=phase==='RETURN'?order.handoverProof?.items.find(p=>p.itemId===line.itemId)?.shots[angle]?.url:order.referencePhotos?.[line.itemId]?.[angle];return url?<img alt={'Đối chiếu '+angle} src={url}/>:<div className="gu-capture-placeholder"/>;})()}</div><div><small>{phase==='RETURN'?'Ảnh khi nhận':'Ảnh khi giao'}</small>{pictures[line.itemId+'|'+angle]?<img src={pictures[line.itemId+'|'+angle]} alt={'Ảnh mới '+angle}/>:<div className="gu-capture-placeholder"><Camera/></div>}
     <label className="btn btn-white gu-capture-select">{sending===line.itemId+'|'+angle?'Đang tải…':pictures[line.itemId+'|'+angle]?'Chụp lại':'Chụp / Chọn ảnh'}<input type="file" accept="image/*" capture="environment" hidden disabled={Boolean(sending)||busy} onChange={e=>{void upload(e.target.files?.[0]||null,line.itemId,angle);e.target.value='';}}/></label></div></div></div>)}
   </article>)}
   {phase==='HANDOVER'&&<section className="gu-v52-deposit-panel"><strong>{clothingPolicy||cameraOrder?'Chọn cọc / CCCD và chụp chứng từ trước khi giao':'Vật cọc khi giao (nếu có)'}</strong>{clothingPolicy&&<p>Cọc tiền theo từng món: trang phục 300.000đ, phụ kiện 200.000đ; hoặc giữ CCCD. Tổng cọc tiền: <b>{money(requiredSecurity)}</b>. Không cộng tiền cọc vào tiền thuê.</p>}<select className="input" value={depositKind} onChange={e=>{setDepositKind(e.target.value as 'CCCD'|'CASH'|'OTHER');setDepositProofId('');}}><option value="CCCD">CCCD / Giấy tờ</option><option value="CASH">Tiền cọc tài sản</option>{!clothingPolicy&&!cameraPolicy&&<option value="OTHER">Vật cọc khác</option>}</select>{clothingPolicy&&<p>{depositKind==='CASH'?`Xác nhận và chụp cọc ${money(requiredSecurity)}.`:'Chụp CCCD đã giữ; trả lại sau khi quyết toán.'}</p>}{cameraOrder&&<p>{cameraPolicy?`Cọc máy ảnh ${money(requiredSecurity)} hoặc CCCD. Cọc tiền tách khỏi doanh thu thuê. Thuê trực tiếp: hoàn cọc trừ tiền thuê và phí; đặt trước: hoàn cọc trừ phí phát sinh.`:'Đơn máy ảnh cũ: đối soát cọc thủ công, không tự đổi lịch sử.'}</p>}<GuSecureUpload purpose="deposit" draftId={depositDraftId} label="Chụp vật cọc / giấy tờ" onUploaded={setDepositProofId}/></section>}
   {phase==='HANDOVER_EXTRA'&&extraSecurity>0&&<section className="gu-v52-deposit-panel"><strong>Thu cọc bổ sung {money(extraSecurity)} cho món mới</strong><p>Cọc theo từng món. Chụp lại ảnh số tiền đã nhận, không dùng ảnh cọc ban đầu.</p><GuSecureUpload purpose="deposit" draftId={depositDraftId} label="Chụp cọc cho món bổ sung" onUploaded={setDepositProofId}/></section>}
   {phase==='RETURN'&&<details className="gu-v52-deposit-panel gu-optional-details"><summary>Kiểm tra chứng từ cọc / CCCD</summary>{(order.handoverDepositProofId||order.hadHandoverDeposit)?<><p>Đã nhận: {order.handoverDepositKind==='CCCD'?'CCCD / Giấy tờ':order.handoverDepositKind==='CASH'?(cameraOrder&&!cameraPolicy?'Tiền cọc · đơn cũ tự đối soát':money(order.handoverCashCollateralAmount||0)+' tiền cọc'):'Vật cọc khác'}. Kiểm tra và trao trả trực tiếp cho khách, không cần chụp lại.</p>{order.handoverDepositProofId?<GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc khách khi giao"/>:<small>Ảnh đã được xóa sau khi Admin duyệt.</small>}</>:<p>Đơn này không lưu ảnh vật cọc.</p>}</details>}
   <footer className="gu-capture-footer"><button type="button" className="btn btn-white" onClick={onClose}>Để sau</button><button type="button" className="btn btn-dark" disabled={!canSend} onClick={()=>void submit()}><CheckCircle2 size={18}/>{busy?'Đang lưu…':phase==='RETURN'?'Nhận đồ · mở thanh toán':'Xác nhận giao hàng'}</button></footer>
  </>}
  {order&&settling&&<section className="gu-v52-settlement gu-settlement-v77" aria-label="Các bước quyết toán khi nhận trả">
   {(()=>{
    const needsPayment=cameraOrder&&cameraPolicy?Boolean(returnQuote?.collect):cameraOrder?due>0:clothingPolicy?Boolean(returnQuote?.collect):due>0;
    const remaining=returnQuote?returnQuote.collect:due;
    const hasCollateral=Boolean(order.handoverDepositProofId||order.hadHandoverDeposit);
    const collateralDone=Boolean(order.collateralReturnedAt);
    const completed=remaining===0&&(!hasCollateral||collateralDone);
    return <>
     <div className="gu-settlement-success"><PackageCheck size={23}/><div><strong>Đã nhận {cameraOrder?'máy ảnh':'sản phẩm'} thành công</strong><span>Hàng đã được ghi nhận. Kiểm tra tiền và hoàn cọc/CCCD để kết thúc.</span></div></div>
     <div className="gu-settlement-money" aria-label="Tóm tắt quyết toán">
      <div><span>Tổng tiền thuê & phụ phí</span><strong>{money(order.total+(order.otherFeeTotal||0)+(order.compensationTotal||0)+(order.lateFeeTotal||0))}</strong></div>
      <div><span>Đã thu tiền thuê</span><strong>{money(order.paid)}</strong></div>
      <div className={remaining>0?'gu-money-attention':'gu-money-complete'}><span>{remaining>0?'Cần khách thanh toán thêm':'Tiền thuê cần thu thêm'}</span><strong>{remaining>0?money(remaining):'0 đ'}</strong></div>
     </div>
     {cameraOrder&&order.cameraOvertimeFeeTotal? <p className="gu-settlement-subnote">Tổng tiền đã bao gồm {money(order.cameraOvertimeFeeTotal)} phí quá giờ máy ảnh đã chốt.</p>:null}
     {returnQuote&&order.handoverDepositKind==='CASH'&&<p className="gu-settlement-subnote">Đã đối chiếu cọc tiền: cấn trừ {money(returnQuote.applied)}. Tiền cọc không được cộng vào doanh thu thuê lần hai.</p>}
     <section className="gu-settlement-step" aria-label="Bước thu tiền">
      <div className="gu-settlement-step-heading"><span className="gu-step-number">1</span><div><h3>Thu tiền còn thiếu</h3><p>{needsPayment?'Ghi nhận số tiền khách vừa trả, nếu chưa thu đủ.':'Không cần thu thêm tiền thuê.'}</p></div><span className={'gu-step-state '+(!needsPayment?'gu-step-done':'')}>{needsPayment?'Cần xử lý':'Đã đủ'}</span></div>
      {needsPayment?<GuOrderPaymentPanel order={order} api={api} onPaid={async()=>{const fresh=await api<{order:RentalOrder}>('v5/orders/'+order.id);setOrder(fresh.order);await onDone();}}/>:<p className="gu-step-ok"><CheckCircle2 size={17}/> Không còn tiền thuê phải thu tại bước này.</p>}
     </section>
     <section className="gu-settlement-step" aria-label="Bước hoàn cọc hoặc giấy tờ">
      <div className="gu-settlement-step-heading"><span className="gu-step-number">2</span><div><h3>Hoàn cọc / trả CCCD</h3><p>{!hasCollateral?'Đơn không ghi nhận vật cọc.':collateralDone?'Đã xác nhận hoàn cọc hoặc giấy tờ.':'Kiểm tra và trả vật cọc trực tiếp cho khách.'}</p></div><span className={'gu-step-state '+(collateralDone||!hasCollateral?'gu-step-done':'')}>{!hasCollateral?'Không có':collateralDone?'Đã xong':'Chưa hoàn'}</span></div>
      {hasCollateral&&<div className="gu-settlement-collateral">
        <div className="gu-collateral-amount"><ShieldCheck size={18}/><span>{cameraOrder&&!cameraPolicy?'Cọc máy ảnh (đơn cũ, đối soát thủ công)':returnQuote?.returnId?'Trả CCCD cho khách':returnQuote?`Hoàn lại ${money(returnQuote.refund)} tiền cọc`:'Đối chiếu vật cọc đã giữ'}</span></div>
        {returnQuote&&returnQuote.collect>0&&<p className="gu-settlement-warning">Cần thu đủ {money(returnQuote.collect)} trước khi xác nhận hoàn cọc / CCCD.</p>}
        {order.handoverDepositProofId&&<details className="gu-optional-details"><summary>Kiểm tra ảnh cọc / CCCD đã giữ</summary><GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc cần hoàn"/></details>}
        {collateralDone?<p className="gu-step-ok"><CheckCircle2 size={17}/> Đã xác nhận hoàn cọc / CCCD.</p>:<button type="button" className="btn btn-dark gu-collateral-confirm" disabled={busy||Boolean(returnQuote?.collect)||(cameraOrder&&!cameraPolicy&&due>0)} onClick={()=>void confirmCollateral()}>Xác nhận đã hoàn cọc / trả CCCD</button>}
      </div>}
     </section>
     {(order.refundPending||0)>0&&<div className="inline-alert danger-alert">Đã thu thừa {money(order.refundPending||0)}. Admin cần đối soát và ghi nhận hoàn tiền thực tế; hàng đã nhận về kho.</div>}
     <details className="gu-optional-details gu-settlement-surcharge"><summary>Phụ thu phát sinh (chỉ nhập nếu thực sự có)</summary><div className="form-grid"><label className="form-field">Số tiền phụ thu<GuMoneyInput className="input" placeholder="Số tiền phát sinh" value={surcharge} onValueChange={setSurcharge}/></label><label className="form-field">Lý do phụ thu<input className="input" value={surchargeReason} onChange={e=>setSurchargeReason(e.target.value)} placeholder="Ví dụ: Hỏng phụ kiện"/></label></div><button type="button" className="btn btn-white" disabled={busy||!(Number(surcharge)>0)||surchargeReason.trim().length<3} onClick={()=>void saveSurcharge(Number(surcharge),surchargeReason)}>Ghi nhận phụ thu</button></details>
     <footer className="gu-v52-settlement-actions gu-settlement-bottom"><div className="gu-settlement-result"><Wallet size={18}/><span>{completed?'Đơn đã quyết toán đủ các bước.':'Còn việc cần xử lý; bạn có thể đóng để tiếp tục sau.'}</span></div><button type="button" className={'btn '+(completed?'btn-dark':'btn-white')} disabled={busy} onClick={onClose}>{completed?'Hoàn tất · Đóng':'Để sau · Đóng'}</button></footer>
    </>;
   })()}
  </section>}
 </section></div>;
}
