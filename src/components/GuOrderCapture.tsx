'use client';
import {uploadImageToApi} from '@/lib/upload-client';
import {useEffect,useMemo,useState} from 'react';
import {Camera,CheckCircle2,X} from 'lucide-react';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuSecureUpload} from './GuSecureUpload';
import {GuOrderPaymentPanel} from './GuOrderPaymentPanel';
import {GuSecurePhoto} from './GuSecurePhoto';
import {GuMoneyInput} from './GuMoneyInput';
import {money} from '@/lib/rental';
import {collateralForLines,collateralReturnQuote,CLOTHING_SETTLEMENT_VERSION} from '@/lib/clothing-collateral';
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
 const requiredSecurity=clothingPolicy&&order?collateralForLines(order.lines):0;
 const extraSecurity=clothingPolicy&&order?.handoverDepositKind==='CASH'&&phase==='HANDOVER_EXTRA'?collateralForLines(order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId))):0;
 const cashAmount=phase==='HANDOVER_EXTRA'?extraSecurity:depositKind==='CASH'&&clothingPolicy?requiredSecurity:0;
 const returnQuote=order&&clothingPolicy&&(['CASH','CCCD'] as string[]).includes(order.handoverDepositKind||'')?collateralReturnQuote({kind:order.handoverDepositKind as 'CASH'|'CCCD',security:order.handoverCashCollateralAmount||0,rent:order.total,extras:(order.otherFeeTotal||0)+(order.compensationTotal||0)+(order.lateFeeTotal||0),paidRent:order.paid}):null;
 const due=order?Math.max(0,order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid):0;
 const lines=useMemo(()=>!order?[]:phase==='HANDOVER_EXTRA'?order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId)):order.lines,[order,phase]);
 const count=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).length),0);
 const completed=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).filter(angle=>Boolean(pictures[l.itemId+'|'+angle])).length),0);
 const missingSetup=lines.some(l=>!order?.photoTemplates?.[l.itemId]?.length);
 const missingReason=phase==='RETURN'&&lines.some(l=>conditions[l.itemId]&&conditions[l.itemId]!=='OK'&&!notes[l.itemId]?.trim());
 const canSend=Boolean(phase&&lines.length>0&&!missingSetup&&!missingReason&&count===completed&&!sending&&!busy&&(!clothingPolicy||phase!=='HANDOVER'||Boolean(depositProofId))&&(!extraSecurity||Boolean(depositProofId)));
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
   const proofs=lines.map(l=>({itemId:l.itemId,shots:Object.fromEntries((order.photoTemplates?.[l.itemId]||[]).map(angle=>[angle,pictures[l.itemId+'|'+angle]||''])),condition:conditions[l.itemId]||'OK',note:notes[l.itemId]||''}));
   await api('v5/orders/'+orderId,{method:'PATCH',body:JSON.stringify({action:phase==='HANDOVER'?'HANDOVER':phase==='HANDOVER_EXTRA'?'HANDOVER_EXTRA':'RECEIVE',items:proofs,...((phase==='HANDOVER'||phase==='HANDOVER_EXTRA')&&depositProofId?{depositProofId,depositDraftId,depositKind,collateralAmount:cashAmount}:{})})});
   const updated=await api<{order:RentalOrder}>('v5/orders/'+orderId);setOrder(updated.order);setPictures({});
   await onDone();if(phase==='RETURN'){setSettling(true);}else onClose();
  }catch(e){setError(e instanceof Error?e.message:'Không hoàn thành kiểm nhận.');}finally{setBusy(false);}
 };
 const confirmCollateral=async()=>{if(!order||returnQuote?.collect||!confirm(returnQuote?`Xác nhận đã ${returnQuote.returnId?'TRẢ CCCD':'HOÀN '+money(returnQuote.refund)+' CỌC'} trực tiếp cho khách?`:'Bạn đã TRẢ vật cọc trực tiếp cho khách?'))return;setBusy(true);setError('');try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'RETURN_COLLATERAL',confirmReturned:true})});setOrder((await api<{order:RentalOrder}>('v5/orders/'+order.id)).order);await onDone();}catch(e){setError(e instanceof Error?e.message:'Không ghi nhận được vật cọc.');}finally{setBusy(false);}};
 const saveSurcharge=async(value:number,reason:string)=>{if(!order)return;setBusy(true);setError('');try{await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'APPLY_SURCHARGE',amount:value,reason})});const fresh=await api<{order:RentalOrder}>('v5/orders/'+order.id);setOrder(fresh.order);setSurcharge('');setSurchargeReason('');await onDone();}catch(e){setError(e instanceof Error?e.message:'Không thêm được phụ thu.');}finally{setBusy(false);}};
 return <div className="gu-capture-overlay" role="presentation"><section role="dialog" aria-modal="true" aria-label="Chụp ảnh giao nhận đơn" className="gu-capture-dialog">
  <header className="gu-capture-header"><div><span className="gu-capture-kicker">Ảnh kiểm nhận · PC & Điện thoại</span><h2>{phase==='RETURN'?'Nhận trả':phase==='HANDOVER_EXTRA'?'Giao thêm đồ':'Bàn giao sản phẩm'}</h2><p>{order?.code||'Đang tải đơn…'} · {order?.customerName||''}</p></div><button type="button" className="icon-btn" aria-label="Đóng kiểm nhận" onClick={onClose}><X/></button></header>
  {error&&<div role="alert" className="inline-alert danger-alert">{error}</div>}
  {order&&!phase&&!settling&&<div className="inline-alert">Đơn đã hoàn thành hoặc không còn ảnh cần chụp.</div>}
  {order&&phase&&<><div className="gu-capture-progress"><span>{completed}/{count} ảnh</span><progress max={Math.max(1,count)} value={completed}/></div>
   {lines.map(line=><article className="gu-capture-item" key={line.itemId}><div className="gu-capture-item-title"><ProductImage paths={items.find(i=>i.id===line.itemId)?.imagePaths}/><div><h3>{line.name}</h3><span>{line.hangerCode||line.sku}</span></div></div>
    {phase==='RETURN'&&<div className="gu-capture-conditions" aria-label={'Tình trạng '+line.name}>{(['OK','ISSUE','MISSING'] as Condition[]).map(c=><button type="button" key={c} className={conditions[line.itemId]===c?'chosen':''} onClick={()=>setConditions(old=>({...old,[line.itemId]:c}))}>{c==='OK'?'Bình thường':c==='ISSUE'?'Có vấn đề':'Thiếu món'}</button>)}
      {conditions[line.itemId]&&conditions[line.itemId]!=='OK'&&<textarea className="input" aria-label="Ghi chú tình trạng" value={notes[line.itemId]||''} onChange={e=>setNotes(old=>({...old,[line.itemId]:e.target.value}))} placeholder="Mô tả tình trạng"/>}</div>}
    {!(phase==='RETURN'&&conditions[line.itemId]==='MISSING')&&(order.photoTemplates?.[line.itemId]||[]).map(angle=><div className="gu-capture-angle" key={angle}><b>{angle}</b><div className="gu-capture-photo-grid"><div><small>{phase==='RETURN'?'Ảnh khi giao':'Ảnh mẫu'}</small>{(()=>{const url=phase==='RETURN'?order.handoverProof?.items.find(p=>p.itemId===line.itemId)?.shots[angle]?.url:order.referencePhotos?.[line.itemId]?.[angle];return url?<img alt={'Đối chiếu '+angle} src={url}/>:<div className="gu-capture-placeholder"/>;})()}</div><div><small>{phase==='RETURN'?'Ảnh khi nhận':'Ảnh khi giao'}</small>{pictures[line.itemId+'|'+angle]?<img src={pictures[line.itemId+'|'+angle]} alt={'Ảnh mới '+angle}/>:<div className="gu-capture-placeholder"><Camera/></div>}
     <label className="btn btn-white gu-capture-select">{sending===line.itemId+'|'+angle?'Đang tải…':pictures[line.itemId+'|'+angle]?'Chụp lại':'Chụp / Chọn ảnh'}<input type="file" accept="image/*" capture="environment" hidden disabled={Boolean(sending)||busy} onChange={e=>{void upload(e.target.files?.[0]||null,line.itemId,angle);e.target.value='';}}/></label></div></div></div>)}
   </article>)}
   {phase==='HANDOVER'&&<section className="gu-v52-deposit-panel"><strong>{clothingPolicy?'Bắt buộc nhận bảo đảm trước khi giao đồ':'Vật cọc của khách khi nhận đồ (nếu có)'}</strong>{clothingPolicy&&<p>Cọc tiền theo từng món: trang phục 300.000đ, phụ kiện 200.000đ; hoặc giữ CCCD. Tổng cọc tiền: <b>{money(requiredSecurity)}</b>. Không cộng tiền cọc vào tiền thuê.</p>}<select className="input" value={depositKind} onChange={e=>{setDepositKind(e.target.value as 'CCCD'|'CASH'|'OTHER');setDepositProofId('');}}><option value="CCCD">CCCD / Giấy tờ</option><option value="CASH">Tiền cọc tài sản</option>{!clothingPolicy&&<option value="OTHER">Vật cọc khác</option>}</select>{clothingPolicy&&<p>{depositKind==='CASH'?`Phải nhận và chụp ${money(requiredSecurity)} tiền cọc.`:'Phải chụp CCCD đã giữ. Nhân viên sẽ trả lại khi khách thanh toán đủ tiền thuê.'}</p>}<GuSecureUpload purpose="deposit" draftId={depositDraftId} label="Chụp vật cọc / giấy tờ" onUploaded={setDepositProofId}/></section>}
   {phase==='HANDOVER_EXTRA'&&extraSecurity>0&&<section className="gu-v52-deposit-panel"><strong>Thu cọc bổ sung {money(extraSecurity)} cho món mới</strong><p>Cọc theo từng món. Chụp lại ảnh số tiền đã nhận, không dùng ảnh cọc ban đầu.</p><GuSecureUpload purpose="deposit" draftId={depositDraftId} label="Chụp cọc cho món bổ sung" onUploaded={setDepositProofId}/></section>}
   {phase==='RETURN'&&<section className="gu-v52-deposit-panel"><strong>Thông tin vật cọc đang giữ · Quyết toán sau kiểm nhận</strong>{(order.handoverDepositProofId||order.hadHandoverDeposit)?<><p>Đã nhận: {order.handoverDepositKind==='CCCD'?'CCCD / Giấy tờ':order.handoverDepositKind==='CASH'?money(order.handoverCashCollateralAmount||0)+' tiền cọc':'Vật cọc khác'}. Kiểm tra và trao trả trực tiếp cho khách, không cần chụp lại.</p>{order.handoverDepositProofId?<GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc khách khi giao"/>:<small>Ảnh đã được xóa sau khi Admin duyệt.</small>}</>:<p>Đơn này không lưu ảnh vật cọc.</p>}</section>}
   <footer className="gu-capture-footer"><button type="button" className="btn btn-white" onClick={onClose}>Để sau</button><button type="button" className="btn btn-dark" disabled={!canSend} onClick={()=>void submit()}><CheckCircle2 size={18}/>{busy?'Đang lưu…':phase==='RETURN'?'Nhận đồ · mở thanh toán':'Xác nhận giao hàng'}</button></footer>
  </>}
  {order&&settling&&<section className="gu-v52-settlement"><h3>Nhận hàng thành công · Đối soát tại quầy</h3><p>Hàng đã chuyển sang kho/giặt ngay, Admin chỉ xem ảnh sau; không treo đồ.</p><div className="booking-total"><span>Tiền thuê / phụ thu / đền bù</span><b>{money(order.total+(order.otherFeeTotal||0)+(order.compensationTotal||0))}</b></div><div className="booking-total"><span>Đã thu tiền thuê</span><b>{money(order.paid)}</b></div><div className="booking-total"><strong>{clothingPolicy?'Cần đối soát tiền thuê (trước khấu trừ cọc)':'Còn phải thu'}</strong><strong>{money(due)}</strong></div>
   <GuOrderPaymentPanel order={order} api={api} onPaid={async()=>{const fresh=await api<{order:RentalOrder}>('v5/orders/'+order.id);setOrder(fresh.order);await onDone();}}/>
   {returnQuote&&<div className="inline-alert"><b>Đối soát bảo đảm:</b> {returnQuote.returnId?'Phải trả CCCD':'Cọc tiền '+money(order.handoverCashCollateralAmount||0)} · Khấu trừ {money(returnQuote.applied)} · Hoàn khách {money(returnQuote.refund)}. {returnQuote.collect>0?'Cần thu thêm '+money(returnQuote.collect)+' trước khi hoàn.':'Không cần thu thêm.'}</div>}
   {due===0&&<div className="inline-alert">Đã thu đủ tiền thuê. Nhân viên xác nhận trả cọc hoặc CCCD trước khi đóng.</div>}
   {order.handoverDepositProofId&&<div className="gu-v52-deposit-panel"><strong>Hoàn lại vật cọc cho khách</strong><p>{returnQuote?returnQuote.returnId?'Đã giữ CCCD, cần thu tiền thuê/phí rồi trả CCCD':`Đã giữ ${money(order.handoverCashCollateralAmount||0)}; khấu trừ ${money(returnQuote.applied)}; phải hoàn lại ${money(returnQuote.refund)}`:'Nhân viên trao trả trực tiếp, không cần chụp ảnh lần thứ hai.'}</p><GuSecurePhoto id={order.handoverDepositProofId} alt="Vật cọc cần hoàn"/>{order.collateralReturnedAt?<p>✓ Đã xác nhận trả vật cọc.</p>:<button className="btn btn-white" disabled={busy||Boolean(returnQuote?.collect)} onClick={()=>void confirmCollateral()}>Xác nhận đã hoàn cọc / CCCD</button>}</div>}
   {(order.refundPending||0)>0&&<div className="inline-alert danger-alert">Đã thu thừa {money(order.refundPending||0)}. Admin cần đối soát và ghi nhận hoàn tiền thực tế; hàng vẫn đã nhận về.</div>}
   <details><summary>Thêm phụ thu khi có phát sinh</summary><div className="form-grid"><label className="form-field">Số tiền phụ thu<GuMoneyInput className="input" placeholder="Tiền phát sinh" value={surcharge} onValueChange={setSurcharge}/></label><label className="form-field">Lý do phụ thu<input className="input" value={surchargeReason} onChange={e=>setSurchargeReason(e.target.value)} placeholder="VD: Hỏng phụ kiện"/></label></div><button className="btn btn-white" disabled={busy||!(Number(surcharge)>0)||surchargeReason.trim().length<3} onClick={()=>void saveSurcharge(Number(surcharge),surchargeReason)}>Cộng phụ thu vào đơn</button></details>
   <footer className="gu-v52-settlement-actions">{clothingPolicy&&!order.collateralReturnedAt&&<p className="inline-alert danger-alert">Chưa hoàn tất việc trả cọc hoặc CCCD cho khách. Phải quyết toán trước khi đánh dấu hoàn thành.</p>}<button className="btn btn-dark" disabled={busy||Boolean(clothingPolicy&&!order.collateralReturnedAt)} onClick={onClose}>Hoàn thành · Đóng</button></footer>
  </section>}
 </section></div>;
}
