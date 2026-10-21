'use client';
import {useState} from 'react';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
export function GuSecureUpload({purpose,draftId,onUploaded,label}:{purpose:'reservation'|'deposit';draftId:string;onUploaded:(id:string)=>void;label:string}){
 const [uploading,setUploading]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 const upload=async(file:File|null)=>{
  if(!file)return;setUploading(true);setError('');setDone(false);onUploaded('');
  try{
   const user=clientAuth().currentUser;if(!user)throw Error('Vui lòng đăng nhập lại');
   const resized=await preparePhonePhoto(file);const body=new FormData();body.set('file',resized);body.set('purpose',purpose);body.set('draftId',draftId);
   const res=await fetch('/api/v5/secure-photo',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken()},body});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Không thể lưu ảnh cọc');
   onUploaded(data.id);setDone(true);
  }catch(e){setError(e instanceof Error?e.message:'Lỗi tải ảnh.');}finally{setUploading(false);}
 };
 return <div className="gu-secure-upload"><label className="btn btn-white" style={{cursor:'pointer'}}>{uploading?'Đang lưu ảnh bảo mật…':done?'✓ Đã lưu ảnh · Chụp lại':label}<input type="file" accept="image/*" capture="environment" hidden disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]||null);e.target.value='';}}/></label><small>Ảnh lưu riêng trên Firebase Storage; không công khai đường dẫn.</small>{error&&<p className="field-error">{error}</p>}</div>;
}
