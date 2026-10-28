'use client';
import {uploadImageToApi} from '@/lib/upload-client';
import {useState} from 'react';
import {clientAuth} from '@/lib/firebase-client';
import {preparePhonePhoto} from '@/lib/mobile-images';
export function GuSecureUpload({purpose,draftId,onUploaded,label}:{purpose:'reservation'|'deposit';draftId:string;onUploaded:(id:string)=>void;label:string}){
 const [uploading,setUploading]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 const upload=async(file:File|null)=>{
  if(!file)return;setUploading(true);setError('');setDone(false);onUploaded('');
  try{
   const user=clientAuth().currentUser;if(!user)throw Error('Vui lòng đăng nhập lại');
   const resized=await preparePhonePhoto(file);
   const data=await uploadImageToApi('/api/v5/secure-photo',resized,await user.getIdToken(),{purpose,draftId});
   if(typeof data.id!=='string')throw Error('Máy chủ không trả mã ảnh.');
   onUploaded(data.id);setDone(true);
  }catch(e){setError(e instanceof Error?e.message:'Lỗi tải ảnh.');}finally{setUploading(false);}
 };
 return <div className="gu-secure-upload"><label className="btn btn-white" style={{cursor:'pointer'}}>{uploading?'Đang lưu ảnh bảo mật…':done?'✓ Đã lưu ảnh · Chụp lại':label}<input type="file" accept="image/*" capture="environment" hidden disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]||null);e.target.value='';}}/></label><small>Ảnh được lưu riêng tư trên VPS, chỉ xem qua GU.</small>{error&&<p className="field-error">{error}</p>}</div>;
}
