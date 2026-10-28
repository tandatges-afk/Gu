'use client';
import {useEffect,useState} from 'react';
import {clientAuth} from '@/lib/firebase-client';
export function GuSecurePhoto({id,alt}:{id?:string;alt:string}){
 const [url,setUrl]=useState('');const [error,setError]=useState(false);
 useEffect(()=>{
  if(!id)return;let active=true;let objectUrl='';setUrl('');setError(false);
  (async()=>{try{const user=clientAuth().currentUser;if(!user)throw Error('Chưa đăng nhập');const res=await fetch('/api/v5/secure-photo?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store'});if(!res.ok)throw Error('Không mở được ảnh');objectUrl=URL.createObjectURL(await res.blob());if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}catch{if(active)setError(true);}})();
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[id]);
 return !id?<span>Không có ảnh</span>:url?<img src={url} alt={alt} style={{maxWidth:'100%',maxHeight:240,objectFit:'contain',borderRadius:10}}/>:<small>{error?'Không mở được ảnh bảo mật':'Đang tải ảnh bảo mật…'}</small>;
}
