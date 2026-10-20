'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuSecureUpload} from './GuSecureUpload';
import {billableBlocks,localDateTimeToISO} from '@/lib/hourly-pricing';
import {rentalCharge,cameraPackageSnapshot,isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import type {InventoryItem,Customer,RentalOrder} from '@/lib/types';
import {money} from '@/lib/rental';
import {matchesProductSearch} from '@/lib/product-search';
import {vietnamToday} from '@/lib/rental';
import {GuVNDateTimeInput} from './GuVNDateTimeInput';
import {isoDayFromVN,isValidHHMM} from '@/lib/vn-datetime';
const localInput=(d:Date)=>new Date(d.getTime()+7*3600000).toISOString().slice(0,16);
function initialTimes(day?:string,endDay?:string,startHour?:string,endHour?:string){
 const now=localInput(new Date(Date.now()+5*60000));
 const pickup=day&&/^\d{4}-\d{2}-\d{2}$/.test(day)?day+'T'+(startHour||now.slice(11)):now;
 const next=endDay&&/^\d{4}-\d{2}-\d{2}$/.test(endDay)?new Date(endDay+'T00:00:00Z'):new Date(pickup+':00Z');
 next.setUTCDate(next.getUTCDate()+1);
 return {pickup,returnAt:next.toISOString().slice(0,10)+'T'+(endHour||pickup.slice(11))};
}
const digits=(s:string)=>s.replace(/\D/g,'').replace(/^84(?=\d{9}$)/,'0');
export function GuV5Booking({items,customers,api,initial,onClose,onSuccess,onCustomerCreated,onCreated,mode='RESERVE'}:{items:InventoryItem[];customers:Customer[];api:ApiCall;initial:{customerId:string;itemIds:string[];note:string;pickupDate?:string;returnDate?:string;pickupHour?:string;returnHour?:string};onClose:()=>void;onSuccess:(message:string)=>Promise<void>;onCustomerCreated:()=>Promise<void>;onCreated?:(id:string)=>void;mode?:'RESERVE'|'PICKUP'}){
 const [customerId,setCustomerId]=useState(initial.customerId);
 const [selected,setSelected]=useState<string[]>(initial.itemIds);
 const [pickupAt,setPickupAt]=useState(()=>initialTimes(initial.pickupDate,initial.returnDate,initial.pickupHour,initial.returnHour).pickup);
 const [returnAt,setReturnAt]=useState(()=>initialTimes(initial.pickupDate,initial.returnDate,initial.pickupHour,initial.returnHour).returnAt);
 const [query,setQuery]=useState('');const [searched,setSearched]=useState<InventoryItem[]>([]);const [selectedRecords,setSelectedRecords]=useState<InventoryItem[]>([]);const [people,setPeople]=useState<Customer[]>([]);const [name,setName]=useState('');const [phone,setPhone]=useState('');const [note,setNote]=useState(initial.note);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [quickCustomer,setQuickCustomer]=useState(false);
 const [showPhoneSuggestions,setShowPhoneSuggestions]=useState(false);
 const [paymentDraftId]=useState(()=>crypto.randomUUID());
 const [reservationProofId,setReservationProofId]=useState('');
 const [confirmPaid,setConfirmPaid]=useState(false);
 const available=[...new Map([...items,...searched,...selectedRecords].map(i=>[i.id,i])).values()];
 useEffect(()=>{const missing=selected.filter(id=>![...items,...searched,...selectedRecords].some(i=>i.id===id));
  if(!missing.length)return;let cancelled=false;
  void api<{results:InventoryItem[]}>('catalog?kind=items&ids='+encodeURIComponent(missing.slice(0,30).join(',')))
   .then(r=>{if(!cancelled)setSelectedRecords(old=>[...old,...r.results]);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Không đọc được món đã chọn.');});
  return()=>{cancelled=true;};
 },[selected,items,searched,selectedRecords,api]);
 const visible=available.filter(i=>!i.archivedAt&&(!query||matchesProductSearch([i.name,i.hangerCode||'',i.category].join(' '),query)));
 useEffect(()=>{if(!query.trim()){setSearched([]);return;}
 let cancelled=false;const timer=setTimeout(()=>{void api<{results:InventoryItem[]}>('catalog?kind=items&q='+encodeURIComponent(query.trim())+'&size=50').then(res=>{if(!cancelled)setSearched(res.results);}).catch(()=>{if(!cancelled)setSearched([]);});},350);
 return()=>{cancelled=true;clearTimeout(timer);};},[query,api]);
 useEffect(()=>{if(phone.trim().length<3){setPeople([]);return;}const timer=setTimeout(()=>{void api<{customers:Customer[]}>('customers?phone='+encodeURIComponent(digits(phone))).then(r=>{setPeople(r.customers);}).catch(()=>setPeople([]));},400);return()=>clearTimeout(timer);},[phone,api,quickCustomer]);
 const blocks=useMemo(()=>{try{return billableBlocks(localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));}catch{return 0;}},[pickupAt,returnAt]);
 const quoteError=selected.some(id=>{const item=available.find(x=>x.id===id);if(!item||!blocks)return false;try{rentalCharge(item,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));return false;}catch{return true;}});
 const total=selected.reduce((sum,id)=>{const item=available.find(x=>x.id===id);try{return sum+(item&&blocks?rentalCharge(item,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt)):0);}catch{return sum;}},0);
 const needsPrepay=pickupAt.slice(0,10)>vietnamToday()||mode==='RESERVE';
 const incomplete=(!customerId&&!quickCustomer)?'Chưa chọn khách hàng.':quickCustomer&&(!name.trim()||digits(phone).length<9)?'Cần nhập tên và số điện thoại hợp lệ cho khách mới.':!selected.length?'Chưa chọn sản phẩm.':selected.some(id=>!available.some(item=>item.id===id))?'Đang tải thông tin sản phẩm đã chọn.':!blocks?'Ngày giờ thuê chưa hợp lệ.':quoteError?'Không thể tính giá của ít nhất một sản phẩm.':needsPrepay&&!confirmPaid?'Chưa xác nhận đã thu đủ 100% tiền thuê.':needsPrepay&&!reservationProofId?'Chưa tải ảnh chứng từ thanh toán thành công.':'';
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setError('');
  const fields=Array.from((e.currentTarget as HTMLFormElement).querySelectorAll('.gu-vn-datetime'));
  if(fields.some(group=>{const inputs=group.querySelectorAll<HTMLInputElement>('input[type="text"]');return inputs.length!==2||!isoDayFromVN(inputs[0].value)||!isValidHHMM(inputs[1].value);})){setError('Ngày và giờ chưa hợp lệ. Nhập theo DD/MM/YYYY và giờ 24h HH:MM (00:00–23:59).');return;}
  if(incomplete){setError(incomplete);return;}setBusy(true);try{let cid=customerId;
   if(quickCustomer){const c=await api<Customer>('customers',{method:'POST',body:JSON.stringify({name,phone,note:''})});cid=c.id;await onCustomerCreated();}
   if(!cid||!selected.length||!blocks)throw Error('Chọn khách, sản phẩm và ngày giờ hợp lệ.');
   if(needsPrepay&&(!reservationProofId||!confirmPaid))throw Error('Đặt trước phải thu đủ 100% tiền thuê và lưu ảnh thanh toán.');
   const r=await api<RentalOrder>('v5/orders',{method:'POST',body:JSON.stringify({customerId:cid,itemIds:selected,pickupAt,returnAt,note,bookingKind:needsPrepay?'RESERVE':'WALK_IN',reservationPaymentProofId:reservationProofId,paymentDraftId,confirmPaid})});
   await onSuccess(`Đã tạo đơn ${r.code}.`);onCreated?.(r.id);
 }catch(e){setError(e instanceof Error?e.message:'Tạo đơn thất bại.');}finally{setBusy(false);}};
 return <form className="modal-body" noValidate onSubmit={e=>void submit(e)}>
  {error&&<div className="inline-alert danger-alert">{error}</div>}
  <div className="gu-v5-stages"><b>1 · Chọn khách và đồ</b><span>2 · Thu trước 100% khi đặt lịch</span><span>3 · Chụp lúc giao và nhận; Admin hậu kiểm</span></div>
  <div className="form-grid"><label className="form-field"><span>Khách hàng</span><select className="input" value={customerId} onChange={e=>{setCustomerId(e.target.value);setQuickCustomer(false);}}><option value="">Chọn khách hàng</option>{[...customers,...people.filter(p=>!customers.some(x=>x.id===p.id))].map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
  <div className="gu-customer-search-anchor"><label className="form-field"><span>Tìm khách theo số điện thoại</span><input autoComplete="off" className="input" value={phone} onFocus={()=>setShowPhoneSuggestions(true)} onBlur={()=>setTimeout(()=>setShowPhoneSuggestions(false),120)} onChange={e=>{setPhone(e.target.value);setCustomerId('');setShowPhoneSuggestions(true);}} placeholder="Gõ SĐT và chọn khách bên dưới"/></label>
  {!quickCustomer&&showPhoneSuggestions&&phone.trim().length>=3&&people.length>0&&<div className="gu-v11-customer-results" role="listbox" aria-label="Gợi ý khách theo số điện thoại">{people.map(c=><button key={c.id} role="option" aria-selected={c.id===customerId} className={'gu-v11-customer-result '+(c.id===customerId?'chosen':'')} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setCustomerId(c.id);setPhone(c.phone);setQuickCustomer(false);setShowPhoneSuggestions(false);}}><strong>{c.name}</strong><span>{c.phone}</span></button>)}</div>}</div></div>
  <button type="button" className="btn btn-white" onClick={()=>setQuickCustomer(v=>!v)}>{quickCustomer?'Chọn khách cũ':'Thêm khách mới ngay'}</button>
  {quickCustomer&&<div className="form-grid"><label className="form-field"><span>Họ tên khách mới</span><input required className="input" value={name} onChange={e=>setName(e.target.value)}/></label><label className="form-field"><span>SĐT khách mới</span><input required className="input" value={phone} onChange={e=>setPhone(e.target.value)}/></label></div>}
  <div className="form-grid"><label className="form-field"><span>Nhận đồ (ngày và giờ)</span><GuVNDateTimeInput required value={pickupAt} onChange={setPickupAt} ariaLabel="Giờ nhận đồ"/></label><label className="form-field"><span>Trả đồ dự kiến</span><GuVNDateTimeInput required value={returnAt} onChange={setReturnAt} ariaLabel="Giờ trả đồ"/></label></div>
  <label className="form-field"><span>Tìm theo tên, mã sản phẩm, danh mục</span><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm sản phẩm..."/></label>
  <div className="gu-v5-product-select">{visible.filter(i=>selected.includes(i.id)).concat(visible.filter(i=>!selected.includes(i.id))).slice(0,80).map(i=><button type="button" key={i.id} className={'gu-v5-product '+(selected.includes(i.id)?'gu-v5-selected':'')} onClick={()=>setSelected(v=>v.includes(i.id)?v.filter(x=>x!==i.id):[...v,i.id])}><ProductImage paths={i.imagePaths}/><span><b>{i.name}</b><small>{i.hangerCode||i.sku} · {i.cameraSerial?'Serial '+i.cameraSerial+' · ':''}{i.category}</small></span><strong>{selected.includes(i.id)?'✓ Đã chọn':'Chọn'}</strong></button>)}</div>
  {selected.map(id=>{const item=available.find(i=>i.id===id);if(!item||!isCameraCategory(item.category)||!isCameraModel(item.cameraModel)||!blocks)return null;try{const pkg=cameraPackageSnapshot(item.cameraModel,localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));return <p key={id} className="gu-camera-package-preview">{item.name} · {item.hangerCode||item.cameraSerial} · Gói {pkg.cameraPackageHours}h: {money(pkg.cameraPackageBasePrice)}. Trả quá giờ: +10.000đ mỗi giờ trễ bắt đầu.</p>;}catch{return null;}})}
  {quoteError&&<div className="inline-alert danger-alert">Có sản phẩm không đủ thông tin để tính giá. Kiểm tra mẫu máy ảnh hoặc khoảng giờ thuê.</div>}
  <div className="booking-total"><div><b>{selected.length} sản phẩm · {blocks||'—'} chu kỳ 24 giờ</b></div><strong>{money(total)}</strong></div>
  {needsPrepay&&<section className="gu-v52-prepay"><strong>ĐẶT LỊCH TRƯỚC · THU ĐỦ 100% TIỀN THUÊ</strong><p>Phải thu và lưu ảnh tiền mặt hoặc chuyển khoản trước khi tạo lịch. Không cần chụp đồ hoặc CCCD lúc này.</p><div className="booking-total"><span>Khách cần thanh toán ngay</span><strong>{money(total)}</strong></div><GuSecureUpload purpose="reservation" draftId={paymentDraftId} onUploaded={setReservationProofId} label="Chụp ảnh tiền cọc / ảnh chuyển khoản"/><label className="gu-refund-confirm"><input type="checkbox" checked={confirmPaid} onChange={e=>setConfirmPaid(e.target.checked)}/> Tôi xác nhận đã thực nhận đủ {money(total)} tiền thuê</label></section>}
  <label className="form-field"><span>Ghi chú đơn</span><input className="input" value={note} onChange={e=>setNote(e.target.value)}/></label>
  {incomplete&&<p className="gu-booking-blockers" role="status">{incomplete} Bạn vẫn có thể bấm Tạo đơn để xem chi tiết lỗi.</p>}
  <div className="modal-actions"><button type="button" className="btn btn-white" onClick={onClose}>Đóng</button><button type="submit" className="btn btn-dark" disabled={busy}>{busy?'Đang tạo…':needsPrepay?'Xác nhận đã thu đủ & giữ lịch':'Tạo đơn giao ngay'}</button></div>
 </form>;
}
