'use client';
import {useEffect,useState} from 'react';
import {Activity,Cloud,Database,ExternalLink,HardDrive,RefreshCw,ShieldAlert} from 'lucide-react';
import {usageStatus,type UsageValue} from '@/lib/usage-metrics';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type Service={source:'provider'|'unavailable';message?:string;updatedAt?:string;quota?:Record<string,number>;collectionCounts?:Record<string,number>;pacificDate?:string;resetsAt?:string;projectId?:string;plan?:string;credits?:UsageValue;freeReferenceCredits?:number;resources?:number|null;reads?:UsageValue;writes?:UsageValue;deletes?:UsageValue;storage?:UsageValue;bandwidth?:UsageValue;transformations?:UsageValue};
type Response={firestore:Service;cloudinary:Service;checkedAt:string;cacheMinutes:number};
const fmt=(n:number|null|undefined)=>n===null||n===undefined?'Chưa có dữ liệu':Math.round(n).toLocaleString('vi-VN');
const fmtBytes=(n:number|null|undefined)=>n===null||n===undefined?'Chưa có dữ liệu':n<1024**2?`${(n/1024).toFixed(1)} KB`:`${(n/1024**3).toFixed(2)} GB`;
function Measure({title,data,bytes=false}:{title:string;data?:UsageValue;bytes?:boolean}){
 const used=data?.used??null,limit=data?.limit??null,percent=limit&&used!==null?Math.min(100,Math.round(used/limit*100)):null;
 const state=usageStatus(used,limit);
 return <div className={'gu-system-meter gu-system-'+state}>
   <div className="gu-system-meter-title"><strong>{title}</strong><span>{percent===null?'Chưa xác minh':percent+'%'}</span></div>
   <div className="gu-system-meter-value">{bytes?fmtBytes(used):fmt(used)} <span>/ {bytes?fmtBytes(limit):fmt(limit)}</span></div>
   <div className="gu-system-progress" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent??undefined}><span style={{width:(percent??0)+'%'}}/></div>
 </div>;
}
export function GuSystem({api}:{api:Api}){
 const [data,setData]=useState<Response|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);try{setData(await api<Response>('system'));setError('');}catch(e){setError(e instanceof Error?e.message:'Không xem được tài nguyên hệ thống.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 return <>
  <div className="page-intro"><div><div className="eyebrow">SYSTEM HEALTH · ADMIN ONLY</div><h1>Hệ thống & dung lượng</h1></div><button className="btn btn-white" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/> {busy?'Đang kiểm tra…':'Cập nhật'}</button></div>
  {error&&<div className="inline-alert danger-alert" role="alert">{error}</div>}
  <div className="gu-system-grid">
   <section className="panel gu-system-card"><div className="gu-system-heading"><Database size={21}/><div><h2>Firebase Firestore</h2><small>Giới hạn miễn phí · 1 cơ sở dữ liệu</small></div></div>
    <Measure title="Lượt đọc hôm nay" data={data?.firestore.reads}/>
    <Measure title="Lượt ghi hôm nay" data={data?.firestore.writes}/>
    <Measure title="Lượt xóa hôm nay" data={data?.firestore.deletes}/>
    <Measure title="Dung lượng dữ liệu + chỉ mục" data={data?.firestore.storage} bytes/>
    <div className="gu-system-collections"><strong>Số bản ghi trong Firestore</strong><div>
       <span>Sản phẩm: {fmt(data?.firestore.collectionCounts?.items)}</span>
       <span>Khách hàng: {fmt(data?.firestore.collectionCounts?.customers)}</span>
       <span>Đơn thuê: {fmt(data?.firestore.collectionCounts?.orders)}</span>
       <span>Đơn còn thiếu tiền: {fmt(data?.firestore.collectionCounts?.debtLedger)}</span>
    </div></div>
    <div className="gu-system-detail"><Activity size={16}/> <span>Ngày thống kê Pacific: <b>{data?.firestore.pacificDate||'—'}</b></span></div>
    <div className="gu-system-detail"><RefreshCw size={16}/><span>Hạn mức đọc/ghi/xóa tự làm mới khoảng: <b>{data?.firestore.resetsAt?new Date(data.firestore.resetsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—'} (giờ VN)</b></span></div>
    <p className="gu-system-note">{data?.firestore.message||'Đang lấy thống kê nhà cung cấp…'}</p>
    <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="gu-system-source">Mở Firebase Console <ExternalLink size={14}/></a>
   </section>
   <section className="panel gu-system-card"><div className="gu-system-heading"><Cloud size={21}/><div><h2>Cloudinary</h2><small>Gói hiện tại: {data?.cloudinary.plan||'Chưa xác định'}</small></div></div>
    <Measure title="Credits hiện tại (30 ngày trượt)" data={data?.cloudinary.credits}/>
    <Measure title="Dung lượng ảnh" data={data?.cloudinary.storage} bytes/>
    <Measure title="Băng thông ảnh" data={data?.cloudinary.bandwidth} bytes/>
    <Measure title="Biến đổi ảnh" data={data?.cloudinary.transformations}/>
    <div className="gu-system-detail"><HardDrive size={16}/><span>Số tài nguyên: <b>{fmt(data?.cloudinary.resources)}</b> · Free tham chiếu: 25 credits</span></div>
    <p className="gu-system-note">{data?.cloudinary.message||'Đang lấy thống kê nhà cung cấp…'}</p>
    <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer" className="gu-system-source">Mở Cloudinary Console <ExternalLink size={14}/></a>
   </section>
  </div>
  <section className="panel gu-system-operations"><h2>Vercel · Web/API</h2><p>Vercel không cung cấp hạn mức tự động qua bộ khóa Firebase/Cloudinary. Xem lưu lượng, Functions và deployment trực tiếp trong Vercel Usage.</p><a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="gu-system-source">Mở Vercel Dashboard <ExternalLink size={14}/></a></section>
  <section className="panel gu-system-operations"><h2><ShieldAlert size={19}/> Lưu ý về vận hành</h2>
   <p>GU không thể tự tăng hạn mức miễn phí hoặc tự reset quota của nhà cung cấp. Khi chưa có quyền Cloud Monitoring, số liệu Firestore hiện <b>Chưa có dữ liệu</b> (không hiển thị 0 giả).</p>
   <p>Cloudinary dùng <b>30 ngày trượt</b>; credits không làm mới về 0 vào đầu tháng. Dung lượng ảnh gốc vẫn tích lũy; GU chỉ có thể giảm tiêu thụ bằng ảnh nhỏ, tải theo nhu cầu và xóa tài nguyên không dùng sau khi đã kiểm tra.</p>
   <p>Cảnh báo 75% và 90% chỉ tham khảo. Thống kê có độ trễ, có thể khác số liệu thanh toán cuối cùng; không dùng đây làm cơ chế ngắt lưu đơn tự động.</p>
   <small>{data?.checkedAt?'Cập nhật gần nhất: '+new Date(data.checkedAt).toLocaleString('vi-VN')+' · cache '+data.cacheMinutes+' phút':'Chưa kết nối số liệu'}.</small>
  </section>
 </>;
}
