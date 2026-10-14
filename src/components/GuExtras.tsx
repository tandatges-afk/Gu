'use client';
import {useEffect,useState, type FormEvent} from 'react';
import {clientAuth} from '@/lib/firebase-client';
import {money} from '@/lib/rental';
import type {StaffProfile,AuditRecord} from '@/lib/types';
import {Camera,Image as ImageIcon,LoaderCircle,Plus,ShieldCheck,UserX,UserCheck,RefreshCw} from 'lucide-react';
export type ApiCall = <T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
export function ProductImage({paths,className='product-photo'}:{paths?:string[];className?:string}){
  const url=paths?.[0]||'';
  return url.startsWith('https://res.cloudinary.com/')?
    <img src={url} alt="Ảnh sản phẩm" className={className} loading="lazy" referrerPolicy="no-referrer"/>:
    <span className="photo-fallback"><ImageIcon size={21}/></span>;
}
export function ImageUploader({paths,onChange,disabled,onUploading}:{paths:string[];onChange:(p:string[])=>void;disabled?:boolean;onUploading?:(value:boolean)=>void}){
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const send=async(files:FileList|null)=>{
    if(!files?.length)return;
    setError('');
    if(paths.length+files.length>5){setError('Tối đa 5 ảnh/sản phẩm.');return;}
    setUploading(true);onUploading?.(true);
    const uploaded=[...paths];
    try{
      const user=clientAuth().currentUser;
      if(!user)throw new Error('Hãy đăng nhập trước khi tải ảnh.');
      for(const file of Array.from(files)){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Chỉ nhận JPG, PNG hoặc WebP.');
        if(file.size>3*1024*1024)throw new Error('Mỗi ảnh tối đa 3 MB.');
        const form=new FormData();form.append('file',file);
        const send=async(forceRefresh:boolean)=>{
          const token=await user.getIdToken(forceRefresh);
          return fetch('/api/uploads',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
        };
        let res=await send(false);
        if(res.status===401)res=await send(true);
        const body=await res.json().catch(()=>({error:'Phản hồi tải ảnh không hợp lệ.'}));
        if(!res.ok||typeof body.path!=='string')throw new Error(body.error||'Tải ảnh lên không thành công.');
        uploaded.push(body.path);
        onChange([...uploaded]);
      }
    }catch(e){setError(e instanceof Error?e.message:'Không thể tải ảnh lên Cloudinary.');}
    finally{setUploading(false);onUploading?.(false);}
  };
  return <div className="uploader"><div className="upload-gallery">{paths.map(p=><div key={p} className="upload-tile"><ProductImage paths={[p]} className="product-photo"/><button className="remove-image" type="button" disabled={disabled||uploading} onClick={()=>onChange(paths.filter(x=>x!==p))} aria-label="Gỡ ảnh">×</button></div>)}<label className="upload-tile upload-add"><Camera size={23}/><span>{uploading?'Đang tải…':'Thêm ảnh'}</span><input disabled={disabled||uploading||paths.length>=5} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{void send(e.target.files);e.target.value='';}}/></label></div><small className="hint">Tối đa 5 ảnh · JPG/PNG/WebP · 3 MB/ảnh · Cloudinary Free</small>{error&&<p className="field-error">{error}</p>}</div>;
}
export function AdminStaffPanel({api}:{api:ApiCall}){
  const [members,setMembers]=useState<StaffProfile[]>([]);
  const [form,setForm]=useState({name:'',email:'',password:''});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const load=async()=>{try{setMembers((await api<{staff:StaffProfile[]}>('staff')).staff);}catch(e){setError(e instanceof Error?e.message:'Không thể tải nhân viên.');}};
  useEffect(()=>{void load();},[]); // fetch on mount; manual reload below
  const create=async(e:FormEvent)=>{
    e.preventDefault();setError('');setSuccess('');setBusy(true);
    try{await api('staff',{method:'POST',body:JSON.stringify(form)});setSuccess(`Đã tạo tài khoản ${form.email}. Hãy cấp mật khẩu ban đầu riêng cho nhân viên và yêu cầu đổi ngay.`);setForm({name:'',email:'',password:''});await load();}
    catch(e){setError(e instanceof Error?e.message:'Không thể tạo tài khoản.');}
    finally{setBusy(false);}
  };
  const toggle=async(m:StaffProfile)=>{
    if(!confirm(`${m.disabled?'Mở':'Khóa'} tài khoản ${m.email}?`))return;
    setBusy(true);setError('');setSuccess('');
    try{await api('staff/'+m.uid,{method:'PATCH',body:JSON.stringify({disabled:!m.disabled})});setSuccess('Đã cập nhật trạng thái tài khoản.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Không thể cập nhật tài khoản.');}
    finally{setBusy(false);}
  };
  return <><div className="page-intro"><div><div className="eyebrow">ACCESS CONTROL</div><h1>Quản lý nhân viên</h1><p>Chỉ Admin tạo, khóa hoặc mở tài khoản. Nhân viên mới luôn có quyền staff.</p></div><button className="btn btn-white" onClick={()=>void load()}><RefreshCw size={16}/> Làm mới</button></div>{error&&<div className="inline-alert danger-alert">{error}</div>}{success&&<div className="inline-alert success-alert">{success}</div>}<div className="extras-grid"><section className="panel extras-panel"><h3>Cấp tài khoản mới</h3><form className="extras-form" onSubmit={e=>void create(e)}><label>Họ tên<input required className="input" value={form.name} maxLength={100} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email đăng nhập<input required type="email" className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Mật khẩu ban đầu (tối thiểu 12 ký tự)<input required minLength={12} type="password" autoComplete="new-password" className="input" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><p className="hint">Mật khẩu không được ghi vào nhật ký và không được gửi qua nhóm chat công khai.</p><button disabled={busy} className="btn btn-dark"><Plus size={17}/> Cấp tài khoản nhân viên</button></form></section><section className="panel extras-panel"><h3>Tài khoản đã cấp ({members.length})</h3><div className="staff-members">{members.map(m=><div className="staff-member" key={m.uid}><div><strong>{m.name}</strong><small>{m.email} · {m.role==='admin'?'Admin':'Nhân viên'}</small><small>{m.disabled?'Đã khóa':'Đang hoạt động'}</small></div>{m.role==='staff'&&<button className={'btn '+(m.disabled?'btn-white':'btn-danger')} disabled={busy} onClick={()=>void toggle(m)}>{m.disabled?<><UserCheck size={16}/> Mở</>:<><UserX size={16}/> Khóa</>}</button>}</div>)}</div></section></div></>;
}
export function AuditPanel({api}:{api:ApiCall}){
  const [logs,setLogs]=useState<AuditRecord[]>([]);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const load=async()=>{try{setLogs((await api<{logs:AuditRecord[]}>('audit')).logs);setError('');}catch(e){setError(e instanceof Error?e.message:'Không thể tải log.');}};
  useEffect(()=>{void load();},[]);
  const filtered=logs.filter(l=>(l.actorName+' '+l.action+' '+l.detail+' '+l.entityId).toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
  return <><div className="page-intro"><div><div className="eyebrow">ACTIVITY AUDIT</div><h1>Nhật ký thao tác</h1><p>Ai đã làm gì, trên đơn hàng hoặc sản phẩm nào, vào thời điểm nào.</p></div><button className="btn btn-white" onClick={()=>void load()}><RefreshCw size={16}/> Làm mới</button></div><div className="panel extras-panel"><div className="audit-tools"><input className="input" placeholder="Tìm nhân viên, thao tác, mã đơn…" value={search} onChange={e=>setSearch(e.target.value)}/><span><ShieldCheck size={16}/> Chỉ Admin xem được</span></div>{error&&<p className="field-error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THAO TÁC</th><th>HÀNH ĐỘNG</th><th>ĐỐI TƯỢNG</th><th>CHI TIẾT</th></tr></thead><tbody>{filtered.map(l=><tr key={l.id}><td>{new Date(l.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td><strong>{l.actorName}</strong><div className="table-sub">{l.actorRole==='admin'?'Admin':'Nhân viên'}</div></td><td>{l.action}</td><td>{l.entityType}<div className="table-sub">{l.entityId.slice(0,12)}…</div></td><td>{l.detail}</td></tr>)}{!filtered.length&&<tr><td colSpan={5}>Chưa có nhật ký phù hợp (hiển thị tối đa 200 thao tác gần nhất).</td></tr>}</tbody></table></div></div></>;
}
export function AmountDue({rent,compensation,paid}:{rent:number;compensation?:number;paid:number}){
  return <>{money(Math.max(0,rent+(compensation||0)-paid))}</>;
}
