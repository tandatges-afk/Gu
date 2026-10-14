'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {AlertCircle, CheckCircle2, Plus, Search, LoaderCircle, ShoppingBag} from 'lucide-react';
import {daysInclusive, money, vietnamToday} from '@/lib/rental';
import type {Customer, InventoryItem, RentalOrder} from '@/lib/types';
import {ProductImage} from './GuExtras';

type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type Availability={available:boolean;conflicts:{itemId:string;sku:string;date:string}[];reason:string};
type Booking={customerId:string;itemIds:string[];pickupDate:string;returnDate:string;depositDue:number;note:string};
const defaultCategory='Tất cả danh mục';
const isBlocked=(item:InventoryItem,mode:'RESERVE'|'PICKUP')=>
  ['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)||!(item.replacementValue>0)||
  (mode==='PICKUP'&&item.status!=='AVAILABLE')||
  (item.status==='RENTED'&&Boolean(item.expectedReturnDate&&item.expectedReturnDate<vietnamToday()));
export function NewRentalForm({items,customers,api,initial,mode,onClose,onSuccess,onCustomerCreated}:{
  items:InventoryItem[]; customers:Customer[];api:Api;initial:Booking;mode:'RESERVE'|'PICKUP';onClose:()=>void;
  onSuccess:(message:string)=>Promise<void>;onCustomerCreated:()=>Promise<void>;
}){
  const [booking,setBooking]=useState<Booking>(initial);
  const [phoneQuery,setPhoneQuery]=useState('');
  const [productQuery,setProductQuery]=useState('');
  const [category,setCategory]=useState(defaultCategory);
  const [inlineCustomer,setInlineCustomer]=useState(false);
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',sizeNote:'',note:''});
  const [extraCustomers,setExtraCustomers]=useState<Customer[]>([]);
  const [remoteCustomers,setRemoteCustomers]=useState<Customer[]>([]);
  const [availability,setAvailability]=useState<Availability|null>(null);
  const [checking,setChecking]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const today=vietnamToday();
  const customerList=useMemo(()=>Array.from(new Map([...customers,...extraCustomers,...remoteCustomers].map(c=>[c.id,c] as const)).values()),[customers,extraCustomers,remoteCustomers]);
  useEffect(()=>{
    const digits=phoneQuery.replace(/\D/g,'');if(digits.length<3){return;}
    let cancelled=false;
    const t=setTimeout(()=>{api<{customers:Customer[]}>('customers?phone='+encodeURIComponent(digits)).then(r=>{if(!cancelled)setRemoteCustomers(r.customers);}).catch(()=>{});},300);
    return()=>{cancelled=true;clearTimeout(t);};
  },[phoneQuery,api]);
  const matchingCustomers=customerList.filter(c=>(c.phone+' '+c.name).toLocaleLowerCase('vi-VN').includes(phoneQuery.trim().toLocaleLowerCase('vi-VN'))).slice(0,30);
  const categories=Array.from(new Set(items.map(x=>x.category))).sort();
  const matchingItems=items.filter(i=>(category===defaultCategory||i.category===category)&&
    (i.name+' '+i.sku+' '+i.size+' '+i.color+' '+i.category).toLocaleLowerCase('vi-VN').includes(productQuery.trim().toLocaleLowerCase('vi-VN')));
  const rentalDays=(()=>{try{return daysInclusive(booking.pickupDate,booking.returnDate);}catch{return 0;}})();
  const selected=items.filter(x=>booking.itemIds.includes(x.id));
  const total=selected.reduce((sum,x)=>sum+x.dailyRate*rentalDays,0);
  useEffect(()=>{
    if(!booking.itemIds.length||!rentalDays||mode==='PICKUP'&&booking.pickupDate!==vietnamToday()){setChecking(false);setAvailability(null);return;}
    let cancel=false;
    const t=setTimeout(()=>{
      setChecking(true);setAvailability(null);
      api<Availability>('availability',{method:'POST',body:JSON.stringify({itemIds:booking.itemIds,pickupDate:booking.pickupDate,returnDate:booking.returnDate})})
        .then(r=>{if(!cancel)setAvailability(r);})
        .catch(e=>{if(!cancel)setAvailability({available:false,conflicts:[],reason:e instanceof Error?e.message:'Lỗi kiểm tra lịch'});})
        .finally(()=>{if(!cancel)setChecking(false);});
    },260);
    setAvailability(null);
    return()=>{cancel=true;clearTimeout(t);};
  },[booking.itemIds,booking.pickupDate,booking.returnDate,mode,api,rentalDays]);
  const saveCustomer=async(e:FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);
    try{
      const c=await api<Customer & {existing?:boolean}>('customers',{method:'POST',body:JSON.stringify(newCustomer)});
      setExtraCustomers(v=>[...v,c]);setBooking(v=>({...v,customerId:c.id}));setPhoneQuery(c.phone);
      setInlineCustomer(false);await onCustomerCreated();
    }catch(e){setError(e instanceof Error?e.message:'Không tạo được khách hàng.');}finally{setBusy(false);}
  };
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);
    try{
      if(!availability?.available)throw new Error('Sản phẩm chưa xác nhận trống lịch.');
      await api('orders',{method:'POST',body:JSON.stringify({...booking,mode})});
      await onSuccess(mode==='RESERVE'?'Đã đặt lịch, khóa kho và chờ khách nhận.':'Đã tạo đơn và ghi nhận giao hàng ngay.');
    }catch(e){setError(e instanceof Error?e.message:'Không tạo được đơn thuê.');}finally{setBusy(false);}
  };
  return <div className="modal-body gu-quick-form">
    {error&&<div className="inline-alert danger-alert"><AlertCircle size={17}/>{error}</div>}
    <div className="gu-flow-tip"><strong>{mode==='RESERVE'?'Đặt lịch trước – chưa giao đồ':'Tạo đơn thuê – khách đã lấy đồ'}</strong><p>{mode==='RESERVE'?'Giữ lịch ngay. Bất kỳ nhân viên nào cũng có thể vào đơn và nhấn “Xác nhận lấy hàng” khi khách đến.':'Đơn được chuyển thẳng sang Đã lấy hàng và cập nhật kho đang thuê.'}</p></div>
    <div className="gu-inline-box">
      <div className="gu-between"><strong>1. Tìm khách hàng bằng SĐT hoặc tên</strong><button className="btn btn-white" type="button" onClick={()=>{setInlineCustomer(v=>!v);setNewCustomer(v=>({...v,phone:/^[\d\s.+()-]{9,}$/.test(phoneQuery)?phoneQuery:v.phone}));}}><Plus size={15}/> Thêm khách hàng</button></div>
      <div className="gu-search-wrap"><Search size={17}/><input className="input" type="search" placeholder="Nhập số điện thoại hoặc tên khách…" value={phoneQuery} onChange={e=>setPhoneQuery(e.target.value)}/></div>
      {booking.customerId&&<p className="gu-selected-customer">Đang chọn: <strong>{customerList.find(c=>c.id===booking.customerId)?.name||'Khách hàng'} · {customerList.find(c=>c.id===booking.customerId)?.phone||''}</strong> <button type="button" onClick={()=>setBooking(v=>({...v,customerId:''}))}>Bỏ chọn</button></p>}
      <div className="gu-choice-list">{matchingCustomers.map(c=><button key={c.id} type="button" className={'gu-choice '+(booking.customerId===c.id?'gu-chosen':'')} onClick={()=>{setBooking(v=>({...v,customerId:c.id}));setPhoneQuery(c.phone);}}><span><b>{c.name}</b><small>{c.phone}{c.sizeNote?' · '+c.sizeNote:''}</small></span>{booking.customerId===c.id&&<CheckCircle2 size={18}/>}</button>)}{!matchingCustomers.length&&<p className="gu-empty-helper">Chưa có khách phù hợp. Chọn “Thêm khách hàng” để tạo ngay.</p>}</div>
      {inlineCustomer&&<form className="gu-customer-inline" onSubmit={e=>void saveCustomer(e)}><div className="form-grid"><label>Họ tên<input required className="input" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})}/></label><label>Số điện thoại<input required className="input" type="tel" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})}/></label><label>Size / số đo<input className="input" value={newCustomer.sizeNote} onChange={e=>setNewCustomer({...newCustomer,sizeNote:e.target.value})}/></label><label>Ghi chú<input className="input" value={newCustomer.note} onChange={e=>setNewCustomer({...newCustomer,note:e.target.value})}/></label></div><button className="btn btn-dark" disabled={busy} type="submit">Lưu và chọn khách</button></form>}
    </div>
    <form onSubmit={e=>void submit(e)}>
      <div className="form-grid"><label className="form-field"><span>Ngày nhận</span><input className="input" type="date" min={today} max={mode==='PICKUP'?today:undefined} value={booking.pickupDate} onChange={e=>setBooking(v=>({...v,pickupDate:e.target.value,returnDate:v.returnDate<e.target.value?e.target.value:v.returnDate}))} required/></label><label className="form-field"><span>Ngày trả (1 ngày = cùng ngày nhận)</span><input className="input" type="date" min={booking.pickupDate} value={booking.returnDate} onChange={e=>setBooking(v=>({...v,returnDate:e.target.value}))} required/></label></div>
      <div className="gu-inline-box"><div className="gu-between"><strong>2. Chọn sản phẩm</strong><span>{selected.length} món · {rentalDays} ngày</span></div>
        <div className="gu-filter-grid"><div className="gu-search-wrap"><Search size={17}/><input className="input" placeholder="Tìm tên, SKU, size, màu…" value={productQuery} onChange={e=>setProductQuery(e.target.value)}/></div><select className="input" value={category} onChange={e=>setCategory(e.target.value)}><option>{defaultCategory}</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="rental-products gu-product-scroll">{matchingItems.map(i=><label key={i.id} className={'rental-product '+(booking.itemIds.includes(i.id)?'rental-selected':'')+' '+(isBlocked(i,mode)?'rental-disabled':'')}><input type="checkbox" disabled={isBlocked(i,mode)} checked={booking.itemIds.includes(i.id)} onChange={e=>setBooking(v=>({...v,itemIds:e.target.checked?[...v.itemIds,i.id]:v.itemIds.filter(x=>x!==i.id)}))}/><ProductImage paths={i.imagePaths}/><span className="rental-prod-text"><strong>{i.name}</strong><small>{i.sku} · {i.category} · {i.size} · {i.status==='AVAILABLE'?'Sẵn sàng':i.status==='RENTED'?'Đang thuê':'Chưa sẵn sàng'}</small></span><b>{money(i.dailyRate)}/ngày</b></label>)}{!matchingItems.length&&<p className="gu-empty-helper">Không có sản phẩm phù hợp.</p>}</div>
      </div>
      <div className={'availability '+(!selected.length||!rentalDays?'neutral':checking?'neutral':availability?.available?'ok':'bad')}>
        {checking?<LoaderCircle size={18} className="spin"/>:availability?.available?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}
        <div><strong>{!selected.length?'Hãy chọn sản phẩm':checking?'Đang đối chiếu lịch…':availability?.available?'Các món đã chọn đang trống lịch':'Chưa thể giữ các món đã chọn'}</strong><small>{availability?.reason||availability?.conflicts?.slice(0,5).map(c=>c.sku+' · '+c.date).join('; ')||'Khi lưu, máy chủ sẽ kiểm tra trùng lần cuối.'}</small></div>
      </div>
      <div className="form-grid"><label className="form-field"><span>Tiền cọc cần thu (VND)</span><input type="number" min={0} max={total} className="input" value={booking.depositDue} onChange={e=>setBooking({...booking,depositDue:Number(e.target.value)})}/></label><label className="form-field"><span>Ghi chú đơn</span><input className="input" value={booking.note} onChange={e=>setBooking({...booking,note:e.target.value})}/></label></div>
      <div className="booking-total"><div><span>Giá thuê dự kiến</span><small>{selected.length} sản phẩm · {rentalDays} ngày (tính cả ngày nhận và trả)</small></div><strong>{money(total)}</strong></div>
      <div className="modal-actions"><button type="button" className="btn btn-white" onClick={onClose}>Đóng</button><button className="btn btn-dark" disabled={busy||checking||!availability?.available||!booking.customerId||booking.depositDue>total||mode==='PICKUP'&&booking.pickupDate!==today}>{busy?<LoaderCircle size={17} className="spin"/>:<ShoppingBag size={17}/>} {mode==='RESERVE'?'Đặt lịch & giữ chỗ':'Tạo đơn & đã giao đồ'}</button></div>
    </form>
  </div>;
}

export function OrderAddItems({order,items,api,onSuccess}:{order:RentalOrder;items:InventoryItem[];api:Api;onSuccess:()=>Promise<void>}){
  const [open,setOpen]=useState(false);const [chosen,setChosen]=useState<string[]>([]);const [query,setQuery]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const today=vietnamToday();const start=order.status==='RESERVED'?order.pickupDate:today>order.pickupDate?today:order.pickupDate;
  const days=(()=>{try{return daysInclusive(start,order.returnDate);}catch{return 0;}})();
  const existing=new Set(order.lines.map(x=>x.itemId));
  const candidates=items.filter(i=>!existing.has(i.id)&&(!query||(i.name+' '+i.sku+' '+i.size+' '+i.category).toLowerCase().includes(query.toLowerCase())));
  const added=items.filter(i=>chosen.includes(i.id));
  const add=async()=>{setError('');setBusy(true);try{await api('orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'ADD_ITEMS',itemIds:chosen})});await onSuccess();setChosen([]);setOpen(false);}catch(e){setError(e instanceof Error?e.message:'Không thêm được sản phẩm.');}finally{setBusy(false);}};
  if(order.status!=='RESERVED'&&order.status!=='PICKED_UP')return null;
  return <div className="gu-inline-box gu-order-add"><div className="gu-between"><strong>Thêm đồ vào đơn</strong><button type="button" className="btn btn-white" onClick={()=>setOpen(v=>!v)}><Plus size={16}/> {open?'Đóng':'Thêm sản phẩm'}</button></div>
    {open&&<><p className="hint">{order.status==='PICKED_UP'?'Đồ thêm sẽ được ghi nhận đã giao ngay.':'Đồ thêm sẽ được giữ lịch, giao cùng đơn khi khách đến.'} Tính từ {start} đến {order.returnDate} ({days} ngày).</p><div className="gu-search-wrap"><Search size={16}/><input className="input" placeholder="Tìm sản phẩm theo tên, SKU, size, danh mục…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="rental-products gu-product-scroll">{candidates.map(i=><label key={i.id} className={'rental-product '+(chosen.includes(i.id)?'rental-selected':'')}><input type="checkbox" disabled={isBlocked(i,order.status==='PICKED_UP'?'PICKUP':'RESERVE')} checked={chosen.includes(i.id)} onChange={e=>setChosen(v=>e.target.checked?[...v,i.id]:v.filter(x=>x!==i.id))}/><ProductImage paths={i.imagePaths}/><span className="rental-prod-text"><strong>{i.name}</strong><small>{i.sku} · {i.size} · {i.category}</small></span><b>{money(i.dailyRate)}/ngày</b></label>)}</div><div className="booking-total"><span>Thêm {chosen.length} món</span><strong>{money(added.reduce((s,i)=>s+i.dailyRate*days,0))}</strong></div>{error&&<p className="field-error">{error}</p>}<button className="btn btn-dark" disabled={busy||!chosen.length||!days} onClick={()=>void add()}>{busy?'Đang thêm…':'Xác nhận thêm đồ vào đơn'}</button></>}
  </div>;
}
