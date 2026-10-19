'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuMoneyInput} from './GuMoneyInput';
import {billableBlocks,localDateTimeToISO} from '@/lib/hourly-pricing';
import {rentalCharge,cameraPackageSnapshot,isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import type {InventoryItem,Customer,RentalOrder} from '@/lib/types';
import {money} from '@/lib/rental';
const localInput=(d:Date)=>new Date(d.getTime()+7*3600000).toISOString().slice(0,16);
export function GuV5Booking({items,customers,api,initial,onClose,onSuccess,onCustomerCreated}:{items:InventoryItem[];customers:Customer[];api:ApiCall;initial:{customerId:string;itemIds:string[];note:string;pickupDate?:string};onClose:()=>void;onSuccess:(message:string)=>Promise<void>;onCustomerCreated:()=>Promise<void>}){
 const [customerId,setCustomerId]=useState(initial.customerId);
 const [selected,setSelected]=useState<string[]>(initial.itemIds);
 const [pickupAt,setPickupAt]=useState(()=>localInput(new Date(Date.now()+5*60000)));
 const [returnAt,setReturnAt]=useState(()=>localInput(new Date(Date.now()+DAY_MS+5*60000)));
 const [query,setQuery]=useState('');const [searched,setSearched]=useState<InventoryItem[]>([]);const [people,setPeople]=useState<Customer[]>([]);const [name,setName]=useState('');const [phone,setPhone]=useState('');const [note,setNote]=useState(initial.note);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [quickCustomer,setQuickCustomer]=useState(false);
 const available=[...new Map([...items,...searched].map(i=>[i.id,i])).values()];
 const visible=available.filter(i=>!i.archivedAt&&(i.name+' '+i.hangerCode+' '+i.category).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
 useEffect(()=>{if(query.trim().length<2){setSearched([]);return;}const timer=setTimeout(()=>{void api<{results:InventoryItem[]}>('catalog?kind=items&q='+encodeURIComponent(query)+'&size=50').then(r=>setSearched(r.results)).catch(()=>{});},400);return()=>clearTimeout(timer);},[query,api]);
 useEffect(()=>{if(phone.trim().length<3){setPeople([]);return;}const timer=setTimeout(()=>{void api<{results:Customer[]}>('catalog?kind=customers&field=phone&q='+encodeURIComponent(phone)+'&size=30').then(r=>setPeople(r.results)).catch(()=>{});},400);return()=>clearTimeout(timer);},[phone,api]);
 const blocks=useMemo(()=>{try{return billableBlocks(localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));}catch{return 0;}},[pickupAt,returnAt]);
 const quoteError=selected.some(id=>{const item=available.find(x=>x.id===id);if(!item||!blocks)return false;try{rentalCharge(item,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));return false;}catch{return true;}});
 const total=selected.reduce((sum,id)=>{const item=available.find(x=>x.id===id);try{return sum+(item&&blocks?rentalCharge(item,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt)):0);}catch{return sum;}},0);
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{let cid=customerId;
   if(quickCustomer){const c=await api<Customer>('customers',{method:'POST',body:JSON.stringify({name,phone,note:''})});cid=c.id;await onCustomerCreated();}
   if(!cid||!selected.length||!blocks)throw Error('Chọn khách, sản phẩm và ngày giờ hợp lệ.');
   const r=await api<RentalOrder>('v5/orders',{method:'POST',body:JSON.stringify({customerId:cid,itemIds:selected,pickupAt,returnAt,note})});
   await onSuccess(`Đã tạo ${r.code}. Đơn đã gửi vào hàng chờ chụp ảnh trên nhân viên mobile.`);
 }catch(e){setError(e instanceof Error?e.message:'Tạo đơn thất bại.');}finally{setBusy(false);}};
 return <form className="modal-body" onSubmit={e=>void submit(e)}>
  {error&&<div className="inline-alert danger-alert">{error}</div>}
  <div className="gu-v5-stages"><b>1 · Chọn khách và đồ</b><span>2 · Mobile chụp ảnh giao</span><span>3 · Nhận trả, Admin duyệt</span></div>
  <div className="form-grid"><label className="form-field"><span>Khách hàng</span><select className="input" value={customerId} onChange={e=>{setCustomerId(e.target.value);setQuickCustomer(false);}}><option value="">Chọn khách hàng</option>{[...customers,...people.filter(p=>!customers.some(x=>x.id===p.id))].map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
  <label className="form-field"><span>Tìm khách theo số điện thoại</span><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Số điện thoại"/></label></div>
  <button type="button" className="btn btn-white" onClick={()=>setQuickCustomer(v=>!v)}>{quickCustomer?'Chọn khách cũ':'Thêm khách mới ngay'}</button>
  {quickCustomer&&<div className="form-grid"><label className="form-field"><span>Họ tên khách mới</span><input required className="input" value={name} onChange={e=>setName(e.target.value)}/></label><label className="form-field"><span>SĐT khách mới</span><input required className="input" value={phone} onChange={e=>setPhone(e.target.value)}/></label></div>}
  <div className="form-grid"><label className="form-field"><span>Nhận đồ (ngày và giờ)</span><input required type="datetime-local" className="input" value={pickupAt} onChange={e=>setPickupAt(e.target.value)}/></label><label className="form-field"><span>Trả đồ dự kiến</span><input required type="datetime-local" className="input" value={returnAt} onChange={e=>setReturnAt(e.target.value)}/></label></div>
  <label className="form-field"><span>Tìm theo tên, mã sản phẩm, danh mục</span><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm sản phẩm..."/></label>
  <div className="gu-v5-product-select">{visible.slice(0,60).map(i=><button type="button" key={i.id} className={'gu-v5-product '+(selected.includes(i.id)?'gu-v5-selected':'')} onClick={()=>setSelected(v=>v.includes(i.id)?v.filter(x=>x!==i.id):[...v,i.id])}><ProductImage paths={i.imagePaths}/><span><b>{i.name}</b><small>{i.hangerCode||i.sku} · {i.cameraSerial?'Serial '+i.cameraSerial+' · ':''}{i.category}</small></span><strong>{selected.includes(i.id)?'✓ Đã chọn':'Chọn'}</strong></button>)}</div>
  {selected.map(id=>{const item=available.find(i=>i.id===id);if(!item||!isCameraCategory(item.category)||!isCameraModel(item.cameraModel)||!blocks)return null;try{const pkg=cameraPackageSnapshot(item.cameraModel,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));return <p key={id} className="gu-camera-package-preview">{item.name} · {item.hangerCode||item.cameraSerial} · Gói {pkg.cameraPackageHours}h: {money(pkg.cameraPackageBasePrice)}. Trả quá giờ: +10.000đ mỗi giờ trễ bắt đầu.</p>;}catch{return null;}})}
  {quoteError&&<div className="inline-alert danger-alert">Có sản phẩm không đủ thông tin để tính giá. Kiểm tra mẫu máy ảnh hoặc khoảng giờ thuê.</div>}
  <div className="booking-total"><div><b>{selected.length} sản phẩm · {blocks||'—'} chu kỳ 24 giờ</b></div><strong>{money(total)}</strong></div>
  <label className="form-field"><span>Ghi chú đơn</span><input className="input" value={note} onChange={e=>setNote(e.target.value)}/></label>
  <div className="modal-actions"><button type="button" className="btn btn-white" onClick={onClose}>Đóng</button><button type="submit" className="btn btn-dark" disabled={busy||quoteError||!blocks||!selected.length||(!customerId&&!quickCustomer)}>{busy?'Đang tạo…':'Tạo đơn → gửi mobile chụp ảnh'}</button></div>
 </form>;
}
const DAY_MS=86400000;
