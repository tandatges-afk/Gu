'use client';

import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
import {GuVisualFinder} from '@/components/GuVisualFinder';
import {ProductImage} from '@/components/GuExtras';
import type {RentalOrder,InventoryItem} from '@/lib/types';
import {
  ArrowLeft,ArrowRight,Bell,Camera,Check,CheckCircle2,ChevronRight,ClipboardCheck,
  Clock3,ImagePlus,LogOut,Package,RefreshCcw,Search,ShieldCheck,Smartphone,TriangleAlert,X,
} from 'lucide-react';

type Stage='HANDOVER'|'OUT';
type Tab='capture'|'search';
type Condition='OK'|'ISSUE'|'MISSING';
type Phase='HANDOVER'|'HANDOVER_EXTRA'|'RETURN'|null;
type Job={orderId:string;code:string;customerName?:string;stage:string;creatorName?:string;pickupAt?:string;returnAt?:string};
const stages:{key:Stage;label:string}[]=[{key:'HANDOVER',label:'Chờ giao'},{key:'OUT',label:'Nhận trả'}];

function errorMessage(error:unknown,fallback:string){return error instanceof Error?error.message:fallback;}
function shortDate(input?:string){if(!input)return '';const d=new Date(input);return Number.isNaN(d.valueOf())?'':d.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function getPhase(order:RentalOrder|null):Phase{
 if(!order)return null;
 if(order.status==='RESERVED')return 'HANDOVER';
 if(order.status==='PICKED_UP'&&order.pendingExtraItemIds?.length)return 'HANDOVER_EXTRA';
 if(order.status==='PICKED_UP'&&order.returnStage!=='AWAITING_ADMIN')return 'RETURN';
 return null;
}

export default function Mobile(){
 const [user,setUser]=useState<User|null>(null);
 const [ready,setReady]=useState(false);
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const [tab,setTab]=useState<Tab>('capture');const [stage,setStage]=useState<Stage>('HANDOVER');
 const [jobs,setJobs]=useState<Job[]>([]);const [newJob,setNewJob]=useState<Job|null>(null);
 const [code,setCode]=useState('');const [order,setOrder]=useState<RentalOrder|null>(null);
 const [items,setItems]=useState<InventoryItem[]>([]);
 const [photos,setPhotos]=useState<Record<string,string>>({});
 const [conditions,setConditions]=useState<Record<string,Condition>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [sending,setSending]=useState('');
 const previousJobIds=useRef<Set<string>|null>(null);
 useEffect(()=>onAuthStateChanged(clientAuth(),u=>{setUser(u);setReady(true);}),[]);
 const api=useCallback(async<T=unknown>(path:string,options?:RequestInit):Promise<T>=>{
  const u=clientAuth().currentUser;if(!u)throw Error('Chưa đăng nhập.');
  const token=await u.getIdToken();const response=await fetch('/api/'+path,{
   ...options,headers:{Authorization:'Bearer '+token,...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers},cache:'no-store',
  });
  const body=await response.json();if(!response.ok)throw Error(body.error||'Không kết nối được máy chủ.');return body as T;
 },[]);
 const fetchJobs=useCallback(async()=>{
  if(!user)return;
  try{
   const result=await api<{jobs:Job[]}>('v5/jobs?stage='+stage);setJobs(result.jobs);
   if(stage==='HANDOVER'){
    const ids=new Set(result.jobs.map(j=>j.orderId));
    if(previousJobIds.current){const incoming=result.jobs.find(j=>!previousJobIds.current?.has(j.orderId));if(incoming)setNewJob(old=>old||incoming);}
    previousJobIds.current=ids;
   }
  }catch(e){setError(errorMessage(e,'Không tải được danh sách.'));}
 },[user,stage,api]);
 useEffect(()=>{if(!user)return;previousJobIds.current=null;void fetchJobs();const t=window.setInterval(()=>{if(!document.hidden)void fetchJobs();},8000);return()=>window.clearInterval(t);},[user,fetchJobs]);
 const openOrder=async(id:string)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api<{order:RentalOrder;items:InventoryItem[]}>('v5/orders/'+id);
   setOrder(result.order);setItems(result.items);setPhotos({});setConditions({});setNotes({});setTab('capture');
  }catch(e){setError(errorMessage(e,'Không thể mở đơn.'));}finally{setBusy(false);}
 };
 const lookup=async()=>{
  setError('');try{const result=await api<{jobs:Job[]}>('v5/jobs?code='+encodeURIComponent(code.trim()));if(!result.jobs.length)throw Error('Không tìm thấy đơn này.');await openOrder(result.jobs[0].orderId);}catch(e){setError(errorMessage(e,'Không tìm thấy đơn.'));}
 };
 const phase=getPhase(order);
 const proofLines=useMemo(()=>{
  if(!order)return [];
  return phase==='HANDOVER_EXTRA'?order.lines.filter(line=>order.pendingExtraItemIds?.includes(line.itemId)):order.lines;
 },[order,phase]);
 const required=useMemo(()=>proofLines.reduce((sum,line)=>sum+((phase==='RETURN'&&conditions[line.itemId]==='MISSING')?0:(order?.photoTemplates?.[line.itemId]||[]).length),0),[proofLines,order,phase,conditions]);
 const completed=useMemo(()=>proofLines.reduce((sum,line)=>sum+((phase==='RETURN'&&conditions[line.itemId]==='MISSING')?0:(order?.photoTemplates?.[line.itemId]||[]).filter(a=>Boolean(photos[line.itemId+'|'+a])).length),0),[proofLines,order,phase,conditions,photos]);
 const missingConfig=proofLines.some(line=>!(order?.photoTemplates?.[line.itemId]?.length));
 const missingNotes=phase==='RETURN'&&proofLines.some(line=>conditions[line.itemId]&&conditions[line.itemId]!=='OK'&&!notes[line.itemId]?.trim());
 const canSubmit=!!phase&&!missingConfig&&required===completed&&!missingNotes&&!busy&&!sending;
 const sendPhoto=async(file:File|null,itemId:string,angle:string)=>{
  if(!file||!order||!phase)return;
  const k=itemId+'|'+angle;setSending(k);setError('');
  try{
   const u=clientAuth().currentUser;if(!u)throw Error('Chưa đăng nhập.');
   const prepared=await preparePhonePhoto(file);const form=new FormData();form.set('file',prepared);
   form.set('purpose',phase==='RETURN'?'return':'handover');form.set('orderId',order.id);
   const response=await fetch('/api/uploads',{method:'POST',headers:{Authorization:'Bearer '+await u.getIdToken()},body:form});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Không tải ảnh được.');
   setPhotos(old=>({...old,[k]:result.path}));
  }catch(e){setError(errorMessage(e,'Tải ảnh thất bại.'));}finally{setSending('');}
 };
 const submit=async()=>{
  if(!order||!phase||!canSubmit)return;
  setBusy(true);setError('');
  try{
   const proofs=proofLines.map(line=>({
    itemId:line.itemId,
    shots:Object.fromEntries((order.photoTemplates?.[line.itemId]||[]).map(angle=>[angle,photos[line.itemId+'|'+angle]||''])),
    condition:conditions[line.itemId]||'OK',note:notes[line.itemId]||'',
   }));
   await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:phase==='HANDOVER'?'HANDOVER':phase==='HANDOVER_EXTRA'?'HANDOVER_EXTRA':'RECEIVE',items:proofs})});
   const isReturn=phase==='RETURN';setOrder(null);setPhotos({});setNotice(isReturn?'Đã gửi ảnh nhận trả cho Admin duyệt.':'Đã xác nhận bàn giao kèm ảnh.');
   await fetchJobs();
  }catch(e){setError(errorMessage(e,'Không gửi được biên bản.'));}finally{setBusy(false);}
 };
 const login=async(e:FormEvent)=>{e.preventDefault();setError('');setBusy(true);try{await signInWithEmailAndPassword(clientAuth(),email,password);}catch{setError('Không thể đăng nhập. Kiểm tra email, mật khẩu hoặc trạng thái tài khoản.');}finally{setBusy(false);}};
 const logout=async()=>{setOrder(null);setJobs([]);previousJobIds.current=null;await signOut(clientAuth());};
 if(!ready)return <main className="gu-v5-mobile gu-mobile-new"><div className="gu-mobile-loader"><span className="gu-mobile-wordmark">GU.</span><p>Đang xác thực tài khoản…</p></div></main>;
 if(!user)return <main className="gu-v5-mobile gu-mobile-new"><section className="gu-mobile-login"><span className="gu-mobile-login-mark">GU.</span><div className="gu-mobile-login-title"><span className="gu-mobile-eyebrow">WORKSPACE / MOBILE</span><h1>Đăng nhập nhân viên</h1><p>Chụp ảnh kiểm nhận và tìm sản phẩm trong kho.</p></div><form onSubmit={e=>void login(e)}><label>Email nhân viên<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="nhanvien@gu.vn" required/></label><label>Mật khẩu<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Nhập mật khẩu" required/></label><button className="gu-mobile-primary" type="submit" disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}<ArrowRight size={18}/></button></form>{error&&<p role="alert" className="gu-mobile-error">{error}</p>}</section></main>;
 return <main className="gu-v5-mobile gu-mobile-new">
  <header className="gu-mobile-topbar"><div className="gu-mobile-brand"><span className="gu-mobile-brand-mark">GU.</span><span><strong>Nhân viên Mobile</strong><small>Giao nhận & tìm bằng ảnh</small></span></div><button className="gu-mobile-icon-button" type="button" title="Đăng xuất" aria-label="Đăng xuất" onClick={()=>void logout()}><LogOut size={19}/></button></header>
  {error&&<div className="gu-mobile-error" role="alert"><TriangleAlert size={18}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Đóng lỗi"><X size={16}/></button></div>}
  {notice&&<div className="gu-mobile-success" role="status"><CheckCircle2 size={19}/>{notice}<button onClick={()=>setNotice('')} aria-label="Đóng thông báo"><X size={16}/></button></div>}
  {newJob&&<div className="gu-mobile-overlay" role="presentation"><div className="gu-mobile-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-new-job"><span className="gu-mobile-dialog-icon"><Bell size={23}/></span><span className="gu-mobile-eyebrow">ĐƠN MỚI TỪ PC</span><h2 id="mobile-new-job">{newJob.code}</h2><p>{newJob.customerName||'Khách hàng'} · Đã sẵn sàng chụp ảnh giao</p><button className="gu-mobile-primary" onClick={()=>{void openOrder(newJob.orderId);setNewJob(null);}}>Mở đơn <ArrowRight size={18}/></button><button className="gu-mobile-quiet" onClick={()=>setNewJob(null)}>Để sau</button></div></div>}
  {tab==='search'&&<section className="gu-mobile-content"><div className="gu-mobile-section-heading"><span className="gu-mobile-eyebrow">TRA CỨU NHANH</span><h1>Tìm bằng hình ảnh</h1><p>Chụp hoặc tải ảnh để xem các sản phẩm gần giống.</p></div><GuVisualFinder api={api}/></section>}
  {tab==='capture'&&!order&&<section className="gu-mobile-content"><div className="gu-mobile-section-heading"><span className="gu-mobile-eyebrow">QUẢN LÝ HÀNG CHỜ</span><h1>Giao & nhận đồ</h1><p>Chọn một đơn để chụp ảnh và ghi nhận hiện trạng.</p></div>
   <div className="gu-mobile-switch" role="group" aria-label="Trạng thái công việc">{stages.map(s=><button type="button" key={s.key} className={stage===s.key?'selected':''} aria-pressed={stage===s.key} onClick={()=>setStage(s.key)}>{s.key==='HANDOVER'?<Camera size={18}/>:<ClipboardCheck size={18}/>} {s.label}</button>)}</div>
   <div className="gu-mobile-row-heading"><div><strong>Danh sách cần xử lý</strong><small>{jobs.length} đơn đang hiển thị</small></div><button className="gu-mobile-icon-button" type="button" aria-label="Làm mới danh sách" onClick={()=>void fetchJobs()}><RefreshCcw size={19}/></button></div>
   <div className="gu-mobile-jobs">{jobs.map(j=><button className="gu-mobile-job-card" key={j.orderId} onClick={()=>void openOrder(j.orderId)}><span className={'gu-mobile-job-icon '+(stage==='HANDOVER'?'handover':'return')}><Package size={20}/></span><span className="gu-mobile-job-text"><b>{j.code}</b><strong>{j.customerName||'Khách hàng'}</strong><small>{j.creatorName?'Tạo bởi '+j.creatorName:''}{j.pickupAt?' · '+shortDate(j.pickupAt):''}</small></span><ChevronRight size={20} className="gu-mobile-job-chevron"/></button>)}{!jobs.length&&<div className="gu-mobile-empty"><CheckCircle2 size={33}/><b>Không có đơn chờ</b><p>Danh sách sẽ tự cập nhật khi nhân viên PC tạo đơn hoặc có đồ cần nhận.</p></div>}</div>
   <div className="gu-mobile-lookup"><label htmlFor="mobile-order-code">Tra cứu theo mã đơn</label><div><input id="mobile-order-code" className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="Nhập mã đơn" onKeyDown={e=>{if(e.key==='Enter')void lookup();}}/><button type="button" onClick={()=>void lookup()} disabled={!code.trim()||busy}><Search size={18}/><span>Tìm</span></button></div></div>
  </section>}
  {tab==='capture'&&order&&<section className="gu-mobile-content gu-mobile-workspace"><button className="gu-mobile-back" onClick={()=>setOrder(null)}><ArrowLeft size={18}/> Danh sách công việc</button>
   <div className="gu-mobile-order-card"><span className="gu-mobile-eyebrow">{phase==='RETURN'?'CHỤP ẢNH NHẬN TRẢ':phase==='HANDOVER_EXTRA'?'GIAO BỔ SUNG':'CHỤP ẢNH BÀN GIAO'}</span><h1>{order.code}</h1><p>{order.customerName}</p><div className="gu-mobile-order-details"><span><span>Nhân viên tạo</span><strong>{order.createdByName||'Chưa rõ'}</strong></span><span><span>Nhân viên giao</span><strong>{order.handoverProof?.byName||'Chưa giao'}</strong></span>{order.returnProof?.byName&&<span><span>Nhân viên nhận</span><strong>{order.returnProof.byName}</strong></span>}</div></div>
   {phase?<><div className="gu-mobile-progress"><div><strong>Tiến độ ảnh</strong><span>{completed}/{required} góc</span></div><div className="gu-mobile-progress-track"><span style={{width:(required?Math.round(100*completed/required):0)+'%'}}/></div></div>
   {proofLines.map((line,index)=>{const cond=conditions[line.itemId]||'OK';const lineAngles=order.photoTemplates?.[line.itemId]||[];const skipped=phase==='RETURN'&&cond==='MISSING';return <article className="gu-mobile-item" key={line.itemId}><header><div className="gu-mobile-item-index">{index+1}</div><div><h2>{line.name}</h2><p>Mã sản phẩm: <strong>{line.hangerCode||line.sku}</strong>{line.cameraSerial?' · SN '+line.cameraSerial:''}</p></div></header><div className="gu-mobile-item-preview"><ProductImage paths={items.find(i=>i.id===line.itemId)?.imagePaths}/><span>{lineAngles.length} góc chụp cần hoàn thành</span></div>
    {phase==='RETURN'&&<div className="gu-mobile-condition"><strong>Tình trạng khi nhận</strong><div role="group" aria-label={'Tình trạng '+line.name}>{([{key:'OK',label:'Bình thường'},{key:'ISSUE',label:'Có vấn đề'},{key:'MISSING',label:'Thiếu món'}] as const).map(opt=><button type="button" key={opt.key} className={cond===opt.key?'selected '+opt.key.toLowerCase():''} onClick={()=>setConditions(v=>({...v,[line.itemId]:opt.key}))}>{opt.label}</button>)}</div></div>}
    {!lineAngles.length&&<div className="gu-mobile-attention"><TriangleAlert size={16}/> Admin chưa thiết lập góc chụp cho sản phẩm này.</div>}
    {!skipped&&lineAngles.map((angle,i)=>{const id=line.itemId+'|'+angle;const photo=photos[id];const reference=phase==='RETURN'?order.handoverProof?.items.find(x=>x.itemId===line.itemId)?.shots[angle]?.url:order.referencePhotos?.[line.itemId]?.[angle];return <div className="gu-mobile-angle" key={angle}><div className="gu-mobile-angle-title"><strong>{String(i+1).padStart(2,'0')}. {angle}</strong>{photo?<span className="gu-mobile-done"><Check size={13}/> Đã chụp</span>:<span className="gu-mobile-pending">Chưa chụp</span>}</div><div className="gu-mobile-photo-pair"><div><span>{phase==='RETURN'?'Ảnh khi giao':'Ảnh mẫu Admin'}</span>{reference?<img src={reference} alt={'Ảnh đối chiếu '+angle}/>:<div className="gu-mobile-photo-placeholder"><Camera size={23}/><small>Chưa có ảnh mẫu</small></div>}</div><div><span>Ảnh {phase==='RETURN'?'nhận lại':'bàn giao'}</span>{photo?<img src={photo} alt={'Ảnh mới '+angle}/>:<div className="gu-mobile-photo-placeholder gu-mobile-to-capture"><ImagePlus size={26}/><small>Chụp ảnh mới</small></div>}</div></div><label className={'gu-mobile-camera-btn'+(photo?' has-photo':'')}><Camera size={17}/>{sending===id?'Đang tải ảnh…':photo?'Chụp lại góc này':'Chụp / tải ảnh'}<input hidden type="file" accept="image/*" capture="environment" disabled={Boolean(sending)||busy} onChange={e=>{void sendPhoto(e.target.files?.[0]||null,line.itemId,angle);e.target.value='';}}/></label></div>;})}
    {phase==='RETURN'&&<label className="gu-mobile-note">Ghi chú tình trạng {cond!=='OK'&&<em>* bắt buộc</em>}<textarea rows={2} placeholder={cond==='OK'?'Không bắt buộc':'Mô tả vấn đề để Admin kiểm tra'} value={notes[line.itemId]||''} onChange={e=>setNotes(v=>({...v,[line.itemId]:e.target.value}))}/></label>}
   </article>;})}
   <div className="gu-mobile-submit-zone"><div><span>{missingConfig?'Thiếu cấu hình ảnh từ Admin':missingNotes?'Cần ghi chú món có vấn đề':completed<required?'Hãy chụp đủ các góc ảnh':'Đã đủ ảnh, sẵn sàng xác nhận'}</span><strong>{completed}/{required}</strong></div><button className="gu-mobile-primary" disabled={!canSubmit} onClick={()=>void submit()}><ShieldCheck size={19}/>{busy?'Đang lưu…':phase==='RETURN'?'Gửi ảnh nhận cho Admin':'Xác nhận đã giao đồ'}</button></div>
   </>:<div className="gu-mobile-empty"><CheckCircle2 size={32}/><b>Đơn đã chuyển bước</b><p>Đơn đang chờ Admin duyệt hoặc đã hoàn tất.</p></div>}
  </section>}
  {!order&&<nav className="gu-mobile-bottom-nav" aria-label="Chức năng mobile"><button className={tab==='capture'?'selected':''} aria-current={tab==='capture'?'page':undefined} onClick={()=>setTab('capture')}><ClipboardCheck size={21}/>Giao / nhận</button><button className={tab==='search'?'selected':''} aria-current={tab==='search'?'page':undefined} onClick={()=>setTab('search')}><Search size={21}/>Tìm bằng ảnh</button></nav>}
 </main>;
}
