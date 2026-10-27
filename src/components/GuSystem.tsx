'use client';
import {formatVNDateTime} from '@/lib/vn-datetime';
import {useEffect,useState} from 'react';
import {Cloud,HardDrive,RefreshCw} from 'lucide-react';
import {usageStatus,type UsageValue} from '@/lib/usage-metrics';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type CloudinaryReport={source:'provider'|'unavailable';message?:string;updatedAt?:string|null;plan?:string;credits?:UsageValue;freeReferenceCredits?:number;resources?:number|null;storage?:UsageValue;bandwidth?:UsageValue;transformations?:UsageValue};
type Response={cloudinary:CloudinaryReport;checkedAt:string;cacheMinutes:number};
type StorageHealth={ok:boolean;bucket:string;location:string|null;projectId:string|null;writeVerified:boolean};
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
 const [storage,setStorage]=useState<StorageHealth|null>(null);const [storageError,setStorageError]=useState('');const [checkingStorage,setCheckingStorage]=useState(false);
 const checkStorage=async(write=false)=>{setCheckingStorage(true);setStorageError('');setStorage(null);try{const result=await api<StorageHealth>('v5/storage-health',write?{method:'POST'}:undefined);setStorage(result);}catch(e){setStorageError(e instanceof Error?e.message:'Không kiểm tra được Storage.');}finally{setCheckingStorage(false);}};
 const load=async(refresh=false)=>{setBusy(true);try{setData(await api<Response>(refresh?'system?refresh=1':'system'));setError('');}catch(e){setError(e instanceof Error?e.message:'Không thể tải thống kê lưu trữ VPS.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const cloud=data?.cloudinary;
 return <>
  <div className="page-intro"><div><h1>Dung lượng lưu trữ VPS</h1></div><button className="btn btn-white" disabled={busy} onClick={()=>void load(true)}><RefreshCw size={16}/>{busy?'Đang tải…':'Cập nhật'}</button></div>
  {error&&<div className="inline-alert danger-alert" role="alert">{error}</div>}
  <section className="panel gu-system-card gu-cloudinary-only" aria-label="Thống kê VPS">
   <div className="gu-system-heading"><Cloud size={21}/><div><h2>Dung lượng & băng thông</h2><small>{cloud?.plan||'GU VPS'}</small></div></div>
   {cloud?.source==='unavailable'&&<p className="inline-alert danger-alert">{cloud.message||'Không lấy được thống kê VPS.'}</p>}
   <Measure title="Credits sử dụng" data={cloud?.credits}/>
   <Measure title="Dung lượng ảnh" data={cloud?.storage} bytes/>
   <Measure title="Băng thông" data={cloud?.bandwidth} bytes/>
   <Measure title="Xử lý ảnh" data={cloud?.transformations}/>
   <div className="gu-system-detail"><HardDrive size={16}/><span>Số ảnh/tài nguyên: <b>{fmt(cloud?.resources)}</b></span></div>
   {cloud?.updatedAt&&<small className="gu-system-updated">Cập nhật: {formatVNDateTime(cloud.updatedAt)}</small>}
  </section>
  <section className="panel gu-system-card" aria-label="Kiểm tra lưu trữ ảnh bảo mật trên VPS">
   <div className="gu-system-heading"><HardDrive size={21}/><h2>VPS · Ảnh cọc</h2></div>
   <div className="action-row">
    <button type="button" className="btn btn-white" disabled={checkingStorage} onClick={()=>void checkStorage()}>{checkingStorage?'Đang kiểm tra…':'Kiểm tra kết nối'}</button>
    <button type="button" className="btn btn-white" disabled={checkingStorage} onClick={()=>void checkStorage(true)}>Thử ghi / xóa</button>
   </div>
   {storage&&<p role="status">Chế độ: <b>{storage.bucket}</b> · Nguồn: <b>{storage.projectId||'—'}</b>{storage.writeVerified?' · Ghi/xóa: Đạt':''}</p>}
   {storageError&&<p className="inline-alert danger-alert" role="alert">{storageError}</p>}
  </section>
 </>;
}
