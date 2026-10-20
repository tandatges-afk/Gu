'use client';
import {formatVNDateTime} from '@/lib/vn-datetime';
import {useEffect,useState} from 'react';
import {Cloud,ExternalLink,HardDrive,RefreshCw} from 'lucide-react';
import {usageStatus,type UsageValue} from '@/lib/usage-metrics';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type CloudinaryReport={source:'provider'|'unavailable';message?:string;updatedAt?:string|null;plan?:string;credits?:UsageValue;freeReferenceCredits?:number;resources?:number|null;storage?:UsageValue;bandwidth?:UsageValue;transformations?:UsageValue};
type Response={cloudinary:CloudinaryReport;checkedAt:string;cacheMinutes:number};
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
 const load=async(refresh=false)=>{setBusy(true);try{setData(await api<Response>(refresh?'system?refresh=1':'system'));setError('');}catch(e){setError(e instanceof Error?e.message:'Không thể tải thống kê Cloudinary.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
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
   {cloud?.updatedAt&&<small className="gu-system-updated">Cập nhật: {formatVNDateTime(cloud.updatedAt)}</small>}
   <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer" className="gu-system-source">Cloudinary Console <ExternalLink size={14}/></a>
  </section>
 </>;
}
