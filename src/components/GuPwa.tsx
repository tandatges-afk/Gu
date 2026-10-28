'use client';

import {useEffect,useState} from 'react';
import {Download, WifiOff, X, Smartphone, Share2} from 'lucide-react';

type InstallPromptEvent = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

export function GuPwaSetup(){
  const [online,setOnline]=useState(true);
  useEffect(()=>{
    setOnline(navigator.onLine);
    const goOnline=()=>setOnline(true);
    const goOffline=()=>setOnline(false);
    window.addEventListener('online',goOnline);
    window.addEventListener('offline',goOffline);
    if ('serviceWorker' in navigator && process.env.NODE_ENV==='production') {
      // The service worker ONLY caches public static assets; never API, tokens or customer data.
      navigator.serviceWorker.register('/gu-sw.js').catch(()=>{});
    }
    return ()=>{window.removeEventListener('online',goOnline);window.removeEventListener('offline',goOffline);};
  },[]);
  return !online?<div className="gu-offline-banner" role="alert"><WifiOff size={16}/> Mất kết nối Internet. Không thể tạo đơn, nhận trả hay cập nhật kho cho đến khi có mạng.</div>:null;
}

export function GuInstallApp(){
  const [deferred,setDeferred]=useState<InstallPromptEvent|null>(null);
  const [instructions,setInstructions]=useState(false);
  const [installed,setInstalled]=useState(false);
  useEffect(()=>{
    const handle=(e:Event)=>{e.preventDefault();setDeferred(e as InstallPromptEvent);};
    const finish=()=>{setInstalled(true);setDeferred(null);};
    window.addEventListener('beforeinstallprompt',handle);
    window.addEventListener('appinstalled',finish);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
    return ()=>{window.removeEventListener('beforeinstallprompt',handle);window.removeEventListener('appinstalled',finish);};
  },[]);
  if(installed)return null;
  return <div className="gu-install-card">
    <div className="gu-install-header"><span className="gu-install-icon"><Smartphone size={20}/></span><div><strong>GU trên điện thoại</strong><small>Thêm GU vào màn hình chính để mở nhanh như ứng dụng.</small></div></div>
    <button className="btn btn-white gu-install-button" type="button" onClick={async()=>{
      if(deferred){try{await deferred.prompt();const r=await deferred.userChoice;if(r.outcome==='accepted')setInstalled(true);setDeferred(null);}catch{setInstructions(true);}}
      else setInstructions(x=>!x);
    }}><Download size={16}/> {deferred?'Cài ứng dụng GU':'Cách thêm vào màn hình chính'}</button>
    {instructions&&<div className="gu-install-instructions"><button className="icon-btn" type="button" aria-label="Ẩn hướng dẫn" onClick={()=>setInstructions(false)}><X size={16}/></button><strong>iPhone/iPad (Safari)</strong><p>Mở GU bằng Safari, nhấn <Share2 size={13}/> Chia sẻ → Thêm vào Màn hình chính → Thêm.</p><strong>Android (Chrome)</strong><p>Nhấn menu ⋮ → Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</p><small>Ứng dụng cần Internet để tạo và xử lý đơn thuê.</small></div>}
  </div>;
}
