'use client';
import {useEffect,useState} from 'react';
import {Cloud,ExternalLink,HardDrive,RefreshCw} from 'lucide-react';
import {usageStatus,type UsageValue} from '@/lib/usage-metrics';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type CloudinaryReport={source:'provider'|'unavailable';message?:string;updatedAt?:string|null;plan?:string;credits?:UsageValue;freeReferenceCredits?:number;resources?:number|null;storage?:UsageValue;bandwidth?:UsageValue;transformations?:UsageValue};
type Response={cloudinary:CloudinaryReport;checkedAt:string;cacheMinutes:number};
type ReadReport={scope:string;disclaimer:string;endpoints:{endpoint:string;calls:number;readsEstimate:number;queries:number;cacheHits:number;lastAt:string}[]};
const fmt=(value:number|null|undefined)=>value==null?'—':value>0&&value<0.01?'< 0,01':value.toLocaleString('vi-VN',{maximumFractionDigits:2});
const fmtBytes=(value:number|null|undefined)=>value==null?'—':value<1024**2?`${(value/1024).toFixed(1)} KB`:`${(value/1024**3).toFixed(2)} GB`;
function Measure({title,data,bytes=false}:{title:string;data?:UsageValue;bytes?:boolean}){
 const used=data?.used??null,limit=data?.limit??null;
 const percent=limit&&used!==null?Math.min(100,Math.round(used/limit*100)):null;
 const state=usageStatus(used,limit);
 return <div className={'gu-system-meter gu-system-'+state}>
  <div className="gu-system-meter-title"><strong>{title}</strong><span>{percent===null?'—':percent+'%'}</span></div>
  <div className="gu-system-meter-value">{bytes?fmtBytes(used):fmt(used)} <span>/ {bytes?fmtBytes(limit):fmt(limit)}</span></div>
  <div className="gu-system-progress" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent??undefined}><span style={{width:(percent??0)+'%'}}/></div>
 </div>;
}
export function GuSystem({api}:{api:Api}){
 const [data,setData]=useState<Response|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [reads,setReads]=useState<ReadReport|null>(null);const [readsError,setReadsError]=useState('');
 const loadReads=async()=>{try{setReads(await api<ReadReport>('system/read-metrics'));setReadsError('');}catch(e){setReadsError(e instanceof Error?e.message:'Không thể tải thống kê API.');}};
 const load=async(refresh=false)=>{setBusy(true);try{setData(await api<Response>(refresh?'system?refresh=1':'system'));setError('');}catch(e){setError(e instanceof Error?e.message:'Không thể tải thống kê Cloudinary.');}finally{setBusy(false);}};
 useEffect(()=>{void load();void loadReads();},[]);
 const cloud=data?.cloudinary;
 return <>
  <div className="page-intro"><div><h1>Cloudinary</h1></div><button className="btn btn-white" disabled={busy} onClick={()=>void load(true)}><RefreshCw size={16}/>{busy?'Đang tải…':'Cập nhật'}</button></div>
  {error&&<div className="inline-alert danger-alert" role="alert">{error}</div>}
  <section className="panel gu-system-card gu-cloudinary-only" aria-label="Thống kê Cloudinary">
   <div className="gu-system-heading"><Cloud size={21}/><div><h2>Dung lượng & băng thông</h2><small>{cloud?.plan||'Cloudinary'}</small></div></div>
   {cloud?.source==='unavailable'&&<p className="inline-alert danger-alert">{cloud.message||'Không lấy được thống kê Cloudinary.'}</p>}
   <Measure title="Credits sử dụng" data={cloud?.credits}/>
   <Measure title="Dung lượng ảnh" data={cloud?.storage} bytes/>
   <Measure title="Băng thông" data={cloud?.bandwidth} bytes/>
   <Measure title="Xử lý ảnh" data={cloud?.transformations}/>
   <div className="gu-system-detail"><HardDrive size={16}/><span>Số ảnh/tài nguyên: <b>{fmt(cloud?.resources)}</b></span></div>
   {cloud?.updatedAt&&<small className="gu-system-updated">Cập nhật: {new Date(cloud.updatedAt).toLocaleString('vi-VN')}</small>}
   <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer" className="gu-system-source">Cloudinary Console <ExternalLink size={14}/></a>
  </section>
  <section className="panel gu-system-card" style={{padding:20,marginTop:18}} aria-label="Theo dõi hiệu năng Firestore">
   <div className="gu-system-heading"><HardDrive size={21}/><div><h2>Firestore · API Reads</h2><small>Chỉ dành cho Admin</small></div></div>
   <button className="btn btn-white" type="button" onClick={()=>void loadReads()} style={{margin:'12px 0'}}><RefreshCw size={16}/> Làm mới thống kê</button>
   <p style={{fontSize:12,color:'#667085',lineHeight:1.6}}>{reads?.disclaimer||'Lưu lượng được thống kê trên tiến trình máy chủ đang xử lý yêu cầu, không phải tổng Usage Firebase.'}</p>
   {readsError&&<p className="inline-alert danger-alert">{readsError}</p>}
   <div className="table-wrap"><table><thead><tr><th>API</th><th>Số lượt</th><th>Đọc ước tính</th><th>Truy vấn</th><th>Cache hit</th></tr></thead><tbody>
    {reads?.endpoints.map(row=><tr key={row.endpoint}><td>{row.endpoint}</td><td>{fmt(row.calls)}</td><td>{fmt(row.readsEstimate)}</td><td>{fmt(row.queries)}</td><td>{fmt(row.cacheHits)}</td></tr>)}
    {!reads?.endpoints.length&&<tr><td colSpan={5}>Chưa có số liệu trong instance này.</td></tr>}
   </tbody></table></div>
  </section>
 </>;
}
