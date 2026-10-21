'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ProductImage,type ApiCall} from './GuExtras';
import {GuSecureUpload} from './GuSecureUpload';
import {billableBlocks,localDateTimeToISO} from '@/lib/hourly-pricing';
import {rentalCharge,chosenCameraPackageSnapshot,cameraBasePrice,isCameraCategory,isCameraModel,CAMERA_TIERS,type CameraPackageHours} from '@/lib/camera-rental';
import type {InventoryItem,Customer,RentalOrder} from '@/lib/types';
import {money} from '@/lib/rental';
import {matchesProductSearch} from '@/lib/product-search';
import {vietnamToday} from '@/lib/rental';
import {GuVNDateTimeInput} from './GuVNDateTimeInput';
import {isoDayFromVN,isValidHHMM} from '@/lib/vn-datetime';
import {productGroup,type RentalGroup} from '@/lib/order-group';
import ui from './GuV5Booking.module.css';
const localInput=(d:Date)=>new Date(d.getTime()+7*3600000).toISOString().slice(0,16);
function initialTimes(day?:string,endDay?:string,startHour?:string,endHour?:string){
 const now=localInput(new Date(Date.now()+5*60000));
 const pickup=day&&/^\d{4}-\d{2}-\d{2}$/.test(day)?day+'T'+(startHour||now.slice(11)):now;
 const next=endDay&&/^\d{4}-\d{2}-\d{2}$/.test(endDay)?new Date(endDay+'T00:00:00Z'):new Date(pickup+':00Z');
 next.setUTCDate(next.getUTCDate()+1);
 return {pickup,returnAt:next.toISOString().slice(0,10)+'T'+(endHour||pickup.slice(11))};
}
const digits=(s:string)=>s.replace(/\D/g,'').replace(/^84(?=\d{9}$)/,'0');
function addPackageHours(pickup:string,hours:CameraPackageHours):string{
 const date=new Date(pickup+':00Z');
 if(!Number.isFinite(date.getTime()))return pickup;
 return new Date(date.getTime()+hours*3600000).toISOString().slice(0,16);
}
export function GuV5Booking({items,customers,api,initial,onClose,onSuccess,onCustomerCreated,onCreated,mode='RESERVE',rentalGroup}:{items:InventoryItem[];customers:Customer[];api:ApiCall;initial:{customerId:string;itemIds:string[];note:string;pickupDate?:string;returnDate?:string;pickupHour?:string;returnHour?:string};onClose:()=>void;onSuccess:(message:string)=>Promise<void>;onCustomerCreated:()=>Promise<void>;onCreated?:(id:string)=>void;mode?:'RESERVE'|'PICKUP';rentalGroup:RentalGroup}){
 const [customerId,setCustomerId]=useState(initial.customerId);
 const [selected,setSelected]=useState<string[]>(initial.itemIds.filter(id=>{const item=items.find(i=>i.id===id);return !item||productGroup(item.category)===rentalGroup;}));
 const [pickupAt,setPickupAt]=useState(()=>initialTimes(initial.pickupDate,initial.returnDate,initial.pickupHour,initial.returnHour).pickup);
 const [returnAt,setReturnAt]=useState(()=>initialTimes(initial.pickupDate,initial.returnDate,initial.pickupHour,initial.returnHour).returnAt);
 const [query,setQuery]=useState('');const [searched,setSearched]=useState<InventoryItem[]>([]);const [selectedRecords,setSelectedRecords]=useState<InventoryItem[]>([]);const [people,setPeople]=useState<Customer[]>([]);const [name,setName]=useState('');const [phone,setPhone]=useState('');const [note,setNote]=useState(initial.note);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [quickCustomer,setQuickCustomer]=useState(false);
 const [showPhoneSuggestions,setShowPhoneSuggestions]=useState(false);
 const [paymentDraftId]=useState(()=>crypto.randomUUID());
 const [reservationProofId,setReservationProofId]=useState('');
 const [cameraPackageHours,setCameraPackageHours]=useState<CameraPackageHours|''>('');
 const available=[...new Map([...items,...searched,...selectedRecords].map(i=>[i.id,i])).values()];
 useEffect(()=>{const missing=selected.filter(id=>![...items,...searched,...selectedRecords].some(i=>i.id===id));
  if(!missing.length)return;let cancelled=false;
  void api<{results:InventoryItem[]}>('catalog?kind=items&ids='+encodeURIComponent(missing.slice(0,30).join(',')))
   .then(r=>{if(!cancelled)setSelectedRecords(old=>[...old,...r.results]);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Không đọc được món đã chọn.');});
  return()=>{cancelled=true;};
 },[selected,items,searched,selectedRecords,api]);
 const cameraItems=selected.map(id=>available.find(i=>i.id===id)).filter((i):i is InventoryItem=>Boolean(i&&isCameraCategory(i.category)));
 // Load a group-scoped first page, not the arbitrary first N items of the whole shop.
 useEffect(()=>{let cancelled=false;void api<{results:InventoryItem[]}>('catalog?kind=items&rentalGroup='+rentalGroup+'&size=50')
  .then(r=>{if(!cancelled)setSearched(old=>[...new Map([...old,...r.results].map(i=>[i.id,i])).values()]);}).catch(()=>{});
 return()=>{cancelled=true;};},[api,rentalGroup]);
 useEffect(()=>{if(cameraPackageHours&&cameraItems.length)setReturnAt(previous=>{const next=addPackageHours(pickupAt,cameraPackageHours);return next===previous?previous:next;});},[pickupAt,cameraPackageHours]);
 const visible=available.filter(i=>!i.archivedAt&&productGroup(i.category)===rentalGroup&&(!query||matchesProductSearch([i.name,i.hangerCode||'',i.category].join(' '),query)));
 useEffect(()=>{if(!query.trim())return;
 let cancelled=false;const timer=setTimeout(()=>{void api<{results:InventoryItem[]}>('catalog?kind=items&q='+encodeURIComponent(query.trim())+'&size=50&rentalGroup='+rentalGroup).then(res=>{if(!cancelled)setSearched(res.results);}).catch(()=>{if(!cancelled)setSearched([]);});},350);
 return()=>{cancelled=true;clearTimeout(timer);};},[query,api,rentalGroup]);
 useEffect(()=>{if(phone.trim().length<3){setPeople([]);return;}const timer=setTimeout(()=>{void api<{customers:Customer[]}>('customers?phone='+encodeURIComponent(digits(phone))).then(r=>{setPeople(r.customers);}).catch(()=>setPeople([]));},400);return()=>clearTimeout(timer);},[phone,api,quickCustomer]);
 const blocks=useMemo(()=>{try{return billableBlocks(localDateTimeToISO(pickupAt),localDateTimeToISO(returnAt));}catch{return 0;}},[pickupAt,returnAt]);
 const pricedLine=(item:InventoryItem)=>{
  const from=localDateTimeToISO(pickupAt),to=localDateTimeToISO(returnAt);
  if(!isCameraCategory(item.category))return rentalCharge(item,from,to);
  if(!isCameraModel(item.cameraModel))throw Error('Máy ảnh chưa có mẫu máy hợp lệ.');
  const snapshot=chosenCameraPackageSnapshot(item.cameraModel,from,to,cameraPackageHours);
  return rentalCharge({...item,...snapshot},from,to);
 };
 const quoteError=selected.some(id=>{const item=available.find(x=>x.id===id);if(!item||!blocks)return false;try{pricedLine(item);return false;}catch{return true;}});
 const total=selected.reduce((sum,id)=>{const item=available.find(x=>x.id===id);try{return sum+(item&&blocks?pricedLine(item):0);}catch{return sum;}},0);
 const needsPrepay=pickupAt.slice(0,10)>vietnamToday()||mode==='RESERVE';
 const incomplete=(!customerId&&!quickCustomer)?'Chưa chọn khách hàng.':quickCustomer&&(!name.trim()||digits(phone).length<9)?'Cần nhập tên và số điện thoại hợp lệ cho khách mới.':!selected.length?'Chưa chọn sản phẩm.':selected.some(id=>!available.some(item=>item.id===id))?'Đang tải thông tin sản phẩm đã chọn.':selected.some(id=>available.some(item=>item.id===id&&productGroup(item.category)!==rentalGroup))?'Đơn đang chứa sản phẩm khác loại. Hãy tạo đơn riêng.':!blocks?'Ngày giờ thuê chưa hợp lệ.':cameraItems.length&&!cameraPackageHours?'Chưa chọn gói thuê máy ảnh 3h/6h/24h/48h.':quoteError?'Không thể tính giá của ít nhất một sản phẩm.':needsPrepay&&!reservationProofId?'Chưa tải ảnh chứng từ thanh toán thành công.':'';
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setError('');
  const fields=Array.from((e.currentTarget as HTMLFormElement).querySelectorAll('.gu-vn-datetime'));
  if(fields.some(group=>{const inputs=group.querySelectorAll<HTMLInputElement>('input[type="text"]');return inputs.length!==2||!isoDayFromVN(inputs[0].value)||!isValidHHMM(inputs[1].value);})){setError('Ngày và giờ chưa hợp lệ. Nhập theo DD/MM/YYYY và giờ 24h HH:MM (00:00–23:59).');return;}
  if(incomplete){setError(incomplete);return;}setBusy(true);try{let cid=customerId;
   if(quickCustomer)cid='QUICK_CUSTOMER';
   if(!cid||!selected.length||!blocks)throw Error('Chọn khách, sản phẩm và ngày giờ hợp lệ.');
   if(needsPrepay&&!reservationProofId)throw Error('Cần chụp ảnh xác nhận tiền cọc/tiền thuê trước khi giữ lịch.');
   const r=await api<RentalOrder>('v5/orders',{method:'POST',body:JSON.stringify({customerId:cid,itemIds:selected,pickupAt,returnAt,note,bookingKind:needsPrepay?'RESERVE':'WALK_IN',reservationPaymentProofId:reservationProofId,paymentDraftId,rentalGroup,cameraPackageHours:cameraItems.length?cameraPackageHours:undefined,...(quickCustomer?{quickCustomer:{name:name.trim(),phone:digits(phone)}}:{})})});
   await onSuccess(`Đã tạo đơn ${r.code}.`);onCreated?.(r.id);
 }catch(e){setError(e instanceof Error?e.message:'Tạo đơn thất bại.');}finally{setBusy(false);}};
 return <form className={`modal-body ${ui.bookingForm}`} noValidate onSubmit={e=>void submit(e)}>
  {error&&<div className="inline-alert danger-alert">{error}</div>}
  <section className={ui.section} aria-labelledby="gu-booking-customer-title">
   <div className={ui.sectionHeading}>
    <h3 id="gu-booking-customer-title">Khách hàng</h3>
    <button type="button" className={ui.quickAction} onClick={()=>{setQuickCustomer(v=>!v);setShowPhoneSuggestions(false);}}>
     {quickCustomer?'← Chọn khách có sẵn':'+ Thêm khách mới'}
    </button>
   </div>
   {!quickCustomer?<div className={ui.customerGrid}>
    <label className={ui.field}><span>Chọn khách hàng</span>
     <select className="input" value={customerId} onChange={e=>{setCustomerId(e.target.value);setQuickCustomer(false);}}>
      <option value="">Chọn khách đã có</option>
      {[...customers,...people.filter(p=>!customers.some(x=>x.id===p.id))].map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
     </select>
    </label>
    <div className={`gu-customer-search-anchor ${ui.phoneAnchor}`}>
     <label className={ui.field}><span>Tìm theo số điện thoại</span>
      <input type="tel" autoComplete="off" className="input" value={phone} onFocus={()=>setShowPhoneSuggestions(true)} onBlur={()=>setTimeout(()=>setShowPhoneSuggestions(false),120)} onChange={e=>{setPhone(e.target.value);setCustomerId('');setShowPhoneSuggestions(true);}} placeholder="Nhập số điện thoại"/>
     </label>
     {showPhoneSuggestions&&phone.trim().length>=3&&people.length>0&&<div className="gu-v11-customer-results" role="listbox" aria-label="Gợi ý khách theo số điện thoại">{people.map(c=><button key={c.id} role="option" aria-selected={c.id===customerId} className={'gu-v11-customer-result '+(c.id===customerId?'chosen':'')} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setCustomerId(c.id);setPhone(c.phone);setQuickCustomer(false);setShowPhoneSuggestions(false);}}><strong>{c.name}</strong><span>{c.phone}</span></button>)}</div>}
    </div>
   </div>:<div className={ui.customerGrid}>
    <label className={ui.field}><span>Tên khách hàng</span><input required className="input" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Họ và tên"/></label>
    <label className={ui.field}><span>Số điện thoại</span><input required type="tel" autoComplete="tel" className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Số điện thoại"/></label>
   </div>}
  </section>
  <section className={ui.section} aria-labelledby="gu-booking-time-title">
   <div className={ui.sectionHeading}><h3 id="gu-booking-time-title">Thời gian thuê</h3></div>
   <div className={ui.dateGrid}>
    <div className={ui.field}><span>Nhận đồ</span><GuVNDateTimeInput required value={pickupAt} onChange={setPickupAt} ariaLabel="Ngày giờ nhận đồ"/></div>
    <div className={ui.field}><span>Trả dự kiến</span><GuVNDateTimeInput required value={returnAt} onChange={setReturnAt} ariaLabel="Ngày giờ trả đồ"/></div>
   </div>
  </section>
  <section className={ui.section} aria-labelledby="gu-booking-product-title">
   <div className={ui.sectionHeading}><h3 id="gu-booking-product-title">Sản phẩm thuê</h3><span className={ui.count}>{selected.length} đã chọn</span></div>
   <label className={ui.searchField}><span className={ui.srOnly}>Tìm sản phẩm theo tên hoặc mã</span><input aria-label={rentalGroup==='CAMERA'?'Tìm máy ảnh':'Tìm trang phục hoặc phụ kiện'} className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm sản phẩm theo tên hoặc mã…"/></label>
   <div className={`gu-v5-product-select ${ui.productList}`}>
    {visible.filter(i=>selected.includes(i.id)).concat(visible.filter(i=>!selected.includes(i.id))).slice(0,80).map(i=><button type="button" key={i.id} aria-pressed={selected.includes(i.id)} className={'gu-v5-product '+ui.productRow+' '+(selected.includes(i.id)?'gu-v5-selected '+ui.chosen:'')} onClick={()=>setSelected(v=>v.includes(i.id)?v.filter(x=>x!==i.id):[...v,i.id])}><ProductImage paths={i.imagePaths}/><span><b>{i.name}</b><small>{i.hangerCode||i.sku} · {i.cameraSerial?'Serial '+i.cameraSerial+' · ':''}{i.category}</small></span><strong>{selected.includes(i.id)?'✓ Đã chọn':'Chọn'}</strong></button>)}
    {visible.length===0&&<p className={ui.empty}>Không tìm thấy sản phẩm phù hợp.</p>}
   </div>
  </section>
  {cameraItems.length>0&&<section className={`gu-camera-package-panel ${ui.packagePanel}`}><label className="form-field"><span>Chọn gói thuê máy ảnh (bắt buộc)</span><select className="input" value={cameraPackageHours} onChange={e=>{const hours=Number(e.target.value) as CameraPackageHours;if(!CAMERA_TIERS.includes(hours))return;setCameraPackageHours(hours);setReturnAt(addPackageHours(pickupAt,hours));}}><option value="">Chọn gói máy ảnh</option>{CAMERA_TIERS.map(hours=><option value={hours} key={hours}>Gói {hours} giờ</option>)}</select></label>
  {cameraPackageHours!==''&&cameraItems.map(item=>isCameraModel(item.cameraModel)?<p key={item.id} className="gu-camera-package-preview">{item.name} · {item.hangerCode||item.cameraSerial} · Gói {cameraPackageHours}h: {money(cameraBasePrice(item.cameraModel,cameraPackageHours))}. Quá hạn thực tế: +10.000đ mỗi giờ trễ bắt đầu.</p>:<p key={item.id} className="field-error">{item.name} chưa có mẫu máy hợp lệ.</p>)}</section>}
  {quoteError&&<div className="inline-alert danger-alert">Có sản phẩm không đủ thông tin để tính giá. Kiểm tra mẫu máy ảnh hoặc khoảng giờ thuê.</div>}
  <div className={`booking-total ${ui.summary}`}><div><b>{selected.length} sản phẩm · {rentalGroup==='CAMERA'?(cameraPackageHours?`Gói máy ảnh ${cameraPackageHours} giờ`:'Chưa chọn gói máy ảnh'):`${blocks||'—'} chu kỳ 24 giờ`}</b></div><strong>{money(total)}</strong></div>
  {needsPrepay&&<section className={`gu-v52-prepay ${ui.prepay}`}><strong>ĐẶT LỊCH TRƯỚC · ẢNH XÁC NHẬN TIỀN CỌC</strong><div className="booking-total"><span>Khách cần thanh toán ngay</span><strong>{money(total)}</strong></div>
<GuSecureUpload purpose="reservation" draftId={paymentDraftId} onUploaded={setReservationProofId} label="Chụp ảnh xác nhận tiền cọc"/></section>}
  <label className={`${ui.field} ${ui.noteField}`}><span>Ghi chú đơn</span><input className="input" value={note} onChange={e=>setNote(e.target.value)}/></label>
  {incomplete&&<p className="gu-booking-blockers" role="status">{incomplete}</p>}
  <div className={`modal-actions ${ui.actions}`}><button type="button" className="btn btn-white" onClick={onClose}>Đóng</button><button type="submit" className="btn btn-dark" disabled={busy}>{busy?'Đang tạo…':needsPrepay?'Lưu ảnh cọc & giữ lịch':'Tạo đơn giao ngay'}</button></div>
 </form>;
}
