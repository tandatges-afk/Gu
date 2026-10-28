'use client';
import {useEffect,useState} from 'react';
import {HardDrive,RefreshCw} from 'lucide-react';
import {formatVNDateTime} from '@/lib/vn-datetime';

type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type SystemReport={vps?:{disk:{used:number;limit:number;free:number};mediaBytes:number;mediaFiles:number};checkedAt:string};
type StorageHealth={ok:boolean;bucket:string;location:string|null;projectId:string|null;writeVerified:boolean};
const fmtBytes=(v:number|null|undefined)=>v==null?'—':v<1024?`${Math.round(v)} B`:v<1024**2?`${(v/1024).toFixed(1)} KB`:v<1024**3?`${(v/1024**2).toFixed(1)} MB`:`${(v/1024**3).toFixed(2)} GB`;

/** Admin-only summary: disk and media metrics are shown exactly once. No estimated bandwidth. */
export function GuSystem({api}:{api:Api}){
 const [data,setData]=useState<SystemReport|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [storage,setStorage]=useState<StorageHealth|null>(null);
 const [storageError,setStorageError]=useState('');const [checkingStorage,setCheckingStorage]=useState(false);
 const checkStorage=async(write=false)=>{
  setCheckingStorage(true);setStorageError('');setStorage(null);
  try{setStorage(await api<StorageHealth>('v5/storage-health',write?{method:'POST'}:undefined));}
  catch(e){setStorageError(e instanceof Error?e.message:'Không kiểm tra được nơi lưu ảnh.');}
  finally{setCheckingStorage(false);}
 };
 const load=async(refresh=false)=>{
  setBusy(true);
  try{setData(await api<SystemReport>(refresh?'system?refresh=1':'system'));setError('');}
  catch(e){setError(e instanceof Error?e.message:'Không thể tải dung lượng VPS.');}
  finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[]);
 const disk=data?.vps?.disk;
 const percent=disk?.limit?Math.min(100,Math.max(0,Math.round(disk.used/disk.limit*100))):0;
 return <section className="gu-system-compact">
  <div className="page-intro"><div><h1>Hệ thống & lưu trữ</h1><p className="gu-system-subtitle">Một nơi theo dõi dung lượng VPS và ảnh của cửa hàng.</p></div><button type="button" className="btn btn-white" disabled={busy} onClick={()=>void load(true)}><RefreshCw size={16}/>{busy?'Đang cập nhật…':'Cập nhật'}</button></div>
  {error&&<div className="inline-alert danger-alert" role="alert">{error}</div>}
  <section className="panel gu-system-card gu-system-overview" aria-label="Dung lượng lưu trữ VPS">
   <div className="gu-system-heading"><HardDrive size={20}/><h2>Dung lượng VPS</h2></div>
   {disk?<>
    <div className="gu-system-kpis"><div><span>Đã dùng</span><strong>{fmtBytes(disk.used)}</strong></div><div><span>Còn trống</span><strong>{fmtBytes(disk.free)}</strong></div><div><span>Tổng dung lượng</span><strong>{fmtBytes(disk.limit)}</strong></div></div>
    <div className="gu-system-progress" role="progressbar" aria-label="Dung lượng ổ đĩa đã sử dụng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:percent+'%'}}/></div>
    <div className="gu-system-media"><span>Ảnh GU: <b>{fmtBytes(data?.vps?.mediaBytes)}</b></span><span>Số ảnh: <b>{(data?.vps?.mediaFiles??0).toLocaleString('vi-VN')}</b></span></div>
    {data?.checkedAt&&<small className="gu-system-updated">Cập nhật: {formatVNDateTime(data.checkedAt)}</small>}
   </>:<p className="gu-system-subtitle">{busy?'Đang đọc thống kê VPS…':'Chưa có dữ liệu. Chọn Cập nhật để thử lại.'}</p>}
  </section>
  <details className="panel gu-system-storage-extra"><summary>Kiểm tra kho ảnh nhạy cảm <span>Chỉ dành cho Admin</span></summary>
   <p className="gu-system-subtitle">Chỉ dùng khi ảnh cọc/CCCD gặp sự cố. Thao tác thử ghi/xóa chỉ tạo và xóa một ảnh thử.</p>
   <div className="action-row"><button type="button" className="btn btn-white" disabled={checkingStorage} onClick={()=>void checkStorage()}>{checkingStorage?'Đang kiểm tra…':'Kiểm tra kết nối'}</button><button type="button" className="btn btn-white" disabled={checkingStorage} onClick={()=>void checkStorage(true)}>Thử ghi / xóa</button></div>
   {storage&&<p role="status">{storage.ok?'Kết nối tốt':'Cần kiểm tra'} · {storage.bucket}{storage.writeVerified?' · Ghi/xóa đạt':''}</p>}
   {storageError&&<p className="inline-alert danger-alert" role="alert">{storageError}</p>}
  </details>
 </section>;
}
