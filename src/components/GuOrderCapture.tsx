'use client';
import {useEffect,useMemo,useState} from 'react';
import {Camera,CheckCircle2,X} from 'lucide-react';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
import {ProductImage,type ApiCall} from './GuExtras';
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
 useEffect(()=>{let live=true;setOrder(null);setPictures({});setConditions({});setNotes({});setError('');
  api<{order:RentalOrder;items:InventoryItem[]}>('v5/orders/'+orderId).then(result=>{if(live){setOrder(result.order);setItems(result.items);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Không lấy được đơn.');});
  return()=>{live=false;};
 },[orderId,api]);
 const phase=order?phaseOf(order):null;
 const lines=useMemo(()=>!order?[]:phase==='HANDOVER_EXTRA'?order.lines.filter(l=>order.pendingExtraItemIds?.includes(l.itemId)):order.lines,[order,phase]);
 const count=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).length),0);
 const completed=lines.reduce((sum,l)=>sum+(phase==='RETURN'&&conditions[l.itemId]==='MISSING'?0:(order?.photoTemplates?.[l.itemId]||[]).filter(angle=>Boolean(pictures[l.itemId+'|'+angle])).length),0);
 const missingSetup=lines.some(l=>!order?.photoTemplates?.[l.itemId]?.length);
 const missingReason=phase==='RETURN'&&lines.some(l=>conditions[l.itemId]&&conditions[l.itemId]!=='OK'&&!notes[l.itemId]?.trim());
 const canSend=Boolean(phase&&lines.length>0&&!missingSetup&&!missingReason&&count===completed&&!sending&&!busy);
 const upload=async(file:File|null,itemId:string,angle:string)=>{
  if(!file||!order||!phase)return;
  const key=itemId+'|'+angle;setSending(key);setError('');
  try{
   const current=clientAuth().currentUser;if(!current)throw Error('Bạn chưa đăng nhập.');
   const resized=await preparePhonePhoto(file);const body=new FormData();body.set('file',resized);body.set('purpose',phase==='RETURN'?'return':'handover');body.set('orderId',order.id);
   const response=await fetch('/api/uploads',{method:'POST',headers:{Authorization:'Bearer '+await current.getIdToken()},body});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Không thể tải ảnh lên.');
   setPictures(old=>({...old,[key]:data.path}));
  }catch(e){setError(e instanceof Error?e.message:'Không thể tải ảnh.');}finally{setSending(null);}
 };
 const submit=async()=>{
  if(!order||!phase||!canSend)return;setBusy(true);setError('');
  try{
   const proofs=lines.map(l=>({itemId:l.itemId,shots:Object.fromEntries((order.photoTemplates?.[l.itemId]||[]).map(angle=>[angle,pictures[l.itemId+'|'+angle]||''])),condition:conditions[l.itemId]||'OK',note:notes[l.itemId]||''}));
   await api('v5/orders/'+orderId,{method:'PATCH',body:JSON.stringify({action:phase==='HANDOVER'?'HANDOVER':phase==='HANDOVER_EXTRA'?'HANDOVER_EXTRA':'RECEIVE',items:proofs})});
   await onDone();onClose();
  }catch(e){setError(e instanceof Error?e.message:'Không hoàn thành kiểm nhận.');}finally{setBusy(false);}
 };
 return <div className="gu-capture-overlay" role="presentation"><section role="dialog" aria-modal="true" aria-label="Chụp ảnh giao nhận đơn" className="gu-capture-dialog">
  <header className="gu-capture-header"><div><span className="gu-capture-kicker">Ảnh kiểm nhận · PC & Điện thoại</span><h2>{phase==='RETURN'?'Nhận trả':phase==='HANDOVER_EXTRA'?'Giao thêm đồ':'Bàn giao sản phẩm'}</h2><p>{order?.code||'Đang tải đơn…'} · {order?.customerName||''}</p></div><button type="button" className="icon-btn" aria-label="Đóng kiểm nhận" onClick={onClose}><X/></button></header>
  {error&&<div role="alert" className="inline-alert danger-alert">{error}</div>}
  {order&&!phase&&<div className="inline-alert">Đơn đã được chụp ảnh hoặc đang chờ Admin duyệt.</div>}
  {order&&phase&&<><div className="gu-capture-progress"><span>{completed}/{count} ảnh</span><progress max={Math.max(1,count)} value={completed}/></div>
   {lines.map(line=><article className="gu-capture-item" key={line.itemId}><div className="gu-capture-item-title"><ProductImage paths={items.find(i=>i.id===line.itemId)?.imagePaths}/><div><h3>{line.name}</h3><span>{line.hangerCode||line.sku}</span></div></div>
    {phase==='RETURN'&&<div className="gu-capture-conditions" aria-label={'Tình trạng '+line.name}>{(['OK','ISSUE','MISSING'] as Condition[]).map(c=><button type="button" key={c} className={conditions[line.itemId]===c?'chosen':''} onClick={()=>setConditions(old=>({...old,[line.itemId]:c}))}>{c==='OK'?'Bình thường':c==='ISSUE'?'Có vấn đề':'Thiếu món'}</button>)}
      {conditions[line.itemId]&&conditions[line.itemId]!=='OK'&&<textarea className="input" aria-label="Ghi chú tình trạng" value={notes[line.itemId]||''} onChange={e=>setNotes(old=>({...old,[line.itemId]:e.target.value}))} placeholder="Mô tả tình trạng"/>}</div>}
    {!(phase==='RETURN'&&conditions[line.itemId]==='MISSING')&&(order.photoTemplates?.[line.itemId]||[]).map(angle=><div className="gu-capture-angle" key={angle}><b>{angle}</b><div className="gu-capture-photo-grid"><div><small>{phase==='RETURN'?'Ảnh khi giao':'Ảnh mẫu'}</small>{(()=>{const url=phase==='RETURN'?order.handoverProof?.items.find(p=>p.itemId===line.itemId)?.shots[angle]?.url:order.referencePhotos?.[line.itemId]?.[angle];return url?<img alt={'Đối chiếu '+angle} src={url}/>:<div className="gu-capture-placeholder"/>;})()}</div><div><small>{phase==='RETURN'?'Ảnh khi nhận':'Ảnh khi giao'}</small>{pictures[line.itemId+'|'+angle]?<img src={pictures[line.itemId+'|'+angle]} alt={'Ảnh mới '+angle}/>:<div className="gu-capture-placeholder"><Camera/></div>}
     <label className="btn btn-white gu-capture-select">{sending===line.itemId+'|'+angle?'Đang tải…':pictures[line.itemId+'|'+angle]?'Chụp lại':'Chụp / Chọn ảnh'}<input type="file" accept="image/*" capture="environment" hidden disabled={Boolean(sending)||busy} onChange={e=>{void upload(e.target.files?.[0]||null,line.itemId,angle);e.target.value='';}}/></label></div></div></div>)}
   </article>)}
   <footer className="gu-capture-footer"><button type="button" className="btn btn-white" onClick={onClose}>Để sau</button><button type="button" className="btn btn-dark" disabled={!canSend} onClick={()=>void submit()}><CheckCircle2 size={18}/>{busy?'Đang lưu…':phase==='RETURN'?'Gửi Admin duyệt':'Xác nhận giao hàng'}</button></footer>
  </>}
 </section></div>;
}
