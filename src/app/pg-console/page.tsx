'use client';
import {useCallback,useEffect,useState,type CSSProperties,type FormEvent} from 'react';

type Me={id:string;name:string;email:string;role:'admin'|'staff'};
type Cat={id:string;name:string};
type Cus={id:string;name:string;phone:string};
type Item={id:string;name:string;sku:string;status:string;daily_rate:string;category:string|null};
type Rental={id:string;code:string;status:string;customer_name:string;pickup_at:string;return_at:string;total_vnd:string;lines:{itemId:string;name:string}[]};
const inputStyle:CSSProperties={minWidth:0,width:'100%',padding:'11px 12px',border:'1px solid #d1d5db',borderRadius:9,background:'#fff',color:'#162419',font:'inherit'};
const btnStyle:CSSProperties={background:'#1f4834',color:'#fff',padding:'11px 15px',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'};
const cardStyle:CSSProperties={background:'#fff',border:'1px solid #e1e7e2',borderRadius:16,padding:22,boxShadow:'0 5px 20px rgba(21,56,34,.04)'};
const fmt=(n:string|number)=>Number(n||0).toLocaleString('vi-VN')+'đ';
const localDate=(date:string)=>new Date(date).toLocaleString('vi-VN');
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const res=await fetch('/api/pg/'+path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(init?.headers||{})}});
 const json=await res.json();if(!res.ok)throw Error(json.error||'Lỗi máy chủ');return json as T;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label style={{display:'grid',gap:5,fontSize:13,fontWeight:600,color:'#34453a'}}>{label}{children}</label>;}
export default function PgConsole(){
 const [me,setMe]=useState<Me|null>(null),[ready,setReady]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [categories,setCategories]=useState<Cat[]>([]),[customers,setCustomers]=useState<Cus[]>([]),[items,setItems]=useState<Item[]>([]),[orders,setOrders]=useState<Rental[]>([]);
 const [catName,setCatName]=useState('');
 const [customerName,setCustomerName]=useState(''),[customerPhone,setCustomerPhone]=useState('');
 const [itemName,setItemName]=useState(''),[itemSku,setItemSku]=useState(''),[dailyRate,setDailyRate]=useState(''),[categoryId,setCategoryId]=useState('');
 const [orderCustomerId,setOrderCustomerId]=useState(''),[chosen,setChosen]=useState<string[]>([]),[pickup,setPickup]=useState(''),[returned,setReturned]=useState('');
 const [tab,setTab]=useState<'orders'|'items'|'customers'>('orders');
 const load=useCallback(async()=>{
  const [c,u,i,o]=await Promise.all([
   request<{categories:Cat[]}>('categories'),request<{customers:Cus[]}>('customers'),
   request<{items:Item[]}>('items'),request<{orders:Rental[]}>('orders')]);
  setCategories(c.categories);setCustomers(u.customers);setItems(i.items);setOrders(o.orders);
 },[]);
 useEffect(()=>{request<{user:Me}>('auth').then(async({user})=>{setMe(user);await load();}).catch(()=>{}).finally(()=>setReady(true));},[load]);
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Lỗi');}finally{setBusy(false);}};
 const login=async(e:FormEvent)=>{e.preventDefault();await act(async()=>{await request('auth',{method:'POST',body:JSON.stringify({email,password})});const {user}=await request<{user:Me}>('auth');setMe(user);setPassword('');await load();});};
 const logout=()=>act(async()=>{await request('auth',{method:'DELETE'});setMe(null);setOrders([]);setItems([]);setCustomers([]);});
 const addCategory=(e:FormEvent)=>{e.preventDefault();void act(async()=>{await request('categories',{method:'POST',body:JSON.stringify({name:catName})});setCatName('');await load();setNotice('Đã tạo danh mục.');});};
 const addCustomer=(e:FormEvent)=>{e.preventDefault();void act(async()=>{await request('customers',{method:'POST',body:JSON.stringify({name:customerName,phone:customerPhone})});setCustomerName('');setCustomerPhone('');await load();setNotice('Đã thêm khách hàng.');});};
 const addItem=(e:FormEvent)=>{e.preventDefault();void act(async()=>{await request('items',{method:'POST',body:JSON.stringify({name:itemName,sku:itemSku,categoryId:categoryId||null,dailyRate:Number(dailyRate),replacementValue:0})});setItemName('');setItemSku('');setDailyRate('');await load();setNotice('Đã thêm sản phẩm.');});};
 const addOrder=(e:FormEvent)=>{e.preventDefault();void act(async()=>{
  if(!pickup||!returned)throw Error('Cần ngày nhận và ngày trả.');
  await request('orders',{method:'POST',body:JSON.stringify({customerId:orderCustomerId,itemIds:chosen,pickupAt:new Date(pickup).toISOString(),returnAt:new Date(returned).toISOString()})});
  setChosen([]);await load();setNotice('Tạo đơn thành công.');
 });};
 const updateOrder=(id:string,status:string)=>act(async()=>{await request('orders/'+id,{method:'PATCH',body:JSON.stringify({status})});await load();setNotice('Đã cập nhật đơn.');});
 if(!ready)return <main style={{padding:40,fontFamily:'system-ui'}}>Đang kết nối PostgreSQL...</main>;
 return <main style={{fontFamily:'system-ui,Arial,sans-serif',minHeight:'100vh',background:'#f5f7f4',color:'#162419',padding:'24px 16px'}}>
 <div style={{maxWidth:1120,margin:'0 auto'}}>
 <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:24}}>
  <div><div style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#47624e'}}>GU / VPS POSTGRESQL</div><h1 style={{fontSize:28,margin:'6px 0'}}>Bảng thử nghiệm cơ sở dữ liệu</h1></div>
  {me&&<button style={btnStyle} onClick={logout} disabled={busy}>Đăng xuất</button>}
 </header>
 {error&&<p role="alert" style={{background:'#fff2f0',color:'#ad2424',padding:12,borderRadius:9}}>{error}</p>}
 {notice&&<p role="status" style={{background:'#e5f4e6',color:'#245631',padding:12,borderRadius:9}}>{notice}</p>}
 {!me?<section style={{...cardStyle,maxWidth:450,margin:'9vh auto'}}><h2>Đăng nhập nội bộ</h2><p style={{color:'#69776c',fontSize:14}}>Dùng tài khoản Admin PostgreSQL mới. Không sử dụng Firebase.</p>
  <form onSubmit={login} style={{display:'grid',gap:14}}><Field label="Email"><input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></Field>
  <Field label="Mật khẩu"><input style={inputStyle} type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></Field>
  <button style={btnStyle} disabled={busy}>Đăng nhập</button></form></section>:
 <>
  <p style={{color:'#637367',marginTop:-10}}>Xin chào <b>{me.name}</b> ({me.role}) · Bản thử nghiệm PostgreSQL, không thay thế giao diện GU hiện tại.</p>
  <nav style={{display:'flex',gap:8,margin:'18px 0',flexWrap:'wrap'}}>{(['orders','items','customers'] as const).map(v=><button key={v} style={{...btnStyle,background:tab===v?'#1f4834':'#e1e9e2',color:tab===v?'white':'#1f4834'}} onClick={()=>setTab(v)}>{v==='orders'?`Đơn thuê (${orders.length})`:v==='items'?`Sản phẩm (${items.length})`:`Khách hàng (${customers.length})`}</button>)}<button style={{...btnStyle,background:'#64766a'}} onClick={()=>void act(load)}>Tải lại</button></nav>
  {tab==='customers'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
   <section style={cardStyle}><h2>Thêm khách hàng</h2><form style={{display:'grid',gap:10}} onSubmit={addCustomer}>
   <Field label="Tên khách"><input style={inputStyle} value={customerName} onChange={e=>setCustomerName(e.target.value)} required/></Field>
   <Field label="Số điện thoại"><input style={inputStyle} type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} required/></Field>
   <button style={btnStyle} disabled={busy}>Thêm khách</button></form></section>
   <section style={cardStyle}><h2>Danh sách khách</h2>{customers.map(c=><p key={c.id} style={{borderBottom:'1px solid #e8e8e8',paddingBottom:8}}><b>{c.name}</b> · {c.phone}</p>)}</section>
  </div>}
  {tab==='items'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
   <section style={cardStyle}><h2>Thêm danh mục</h2><form style={{display:'flex',gap:8}} onSubmit={addCategory}><input style={inputStyle} value={catName} onChange={e=>setCatName(e.target.value)} placeholder="Tên danh mục" required/><button style={btnStyle} disabled={busy}>Thêm</button></form>
   <h2>Thêm sản phẩm</h2><form style={{display:'grid',gap:10}} onSubmit={addItem}>
    <Field label="Tên sản phẩm"><input style={inputStyle} value={itemName} onChange={e=>setItemName(e.target.value)} required/></Field>
    <Field label="Mã sản phẩm"><input style={inputStyle} value={itemSku} onChange={e=>setItemSku(e.target.value)} required/></Field>
    <Field label="Danh mục"><select style={inputStyle} value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Chưa phân loại</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field label="Giá thuê/ngày (VND)"><input style={inputStyle} type="number" min="0" value={dailyRate} onChange={e=>setDailyRate(e.target.value)} required/></Field>
    <button style={btnStyle} disabled={busy||me.role!=='admin'}>Tạo sản phẩm</button></form></section>
   <section style={cardStyle}><h2>Sản phẩm hiện tại</h2>{items.map(i=><p key={i.id} style={{borderBottom:'1px solid #e8e8e8',paddingBottom:8}}><b>{i.name}</b> · {i.sku}<br/><small>{i.category||'Chưa phân loại'} · {fmt(i.daily_rate)} · {i.status}</small></p>)}</section>
  </div>}
  {tab==='orders'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
   <section style={cardStyle}><h2>Tạo đơn thuê</h2><form style={{display:'grid',gap:12}} onSubmit={addOrder}>
   <Field label="Khách hàng"><select style={inputStyle} value={orderCustomerId} onChange={e=>setOrderCustomerId(e.target.value)} required><option value="">Chọn khách hàng</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>
   <Field label="Ngày giờ nhận"><input style={inputStyle} type="datetime-local" value={pickup} onChange={e=>setPickup(e.target.value)} required/></Field>
   <Field label="Ngày giờ trả"><input style={inputStyle} type="datetime-local" value={returned} onChange={e=>setReturned(e.target.value)} required/></Field>
   <div style={{fontSize:13,fontWeight:700}}>Chọn sản phẩm ({chosen.length})</div><div style={{maxHeight:220,overflow:'auto',border:'1px solid #e2e7e2',padding:10,borderRadius:9}}>{items.map(i=><label key={i.id} style={{display:'block',padding:6}}><input type="checkbox" checked={chosen.includes(i.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,i.id]:old.filter(x=>x!==i.id))}/> {i.name} ({i.sku}) · {fmt(i.daily_rate)}</label>)}</div>
   <button style={btnStyle} disabled={busy||chosen.length===0}>Tạo đơn và khóa lịch thuê</button></form></section>
   <section style={cardStyle}><h2>Đơn thuê mới</h2>{orders.map(o=><article key={o.id} style={{borderBottom:'1px solid #e2e7e2',padding:'12px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{o.code}</b><b>{o.status}</b></div><p style={{margin:'7px 0'}}>{o.customer_name} · {fmt(o.total_vnd)}</p><p style={{fontSize:12,color:'#69776c'}}>Nhận {localDate(o.pickup_at)} · Trả {localDate(o.return_at)}</p><p style={{fontSize:13}}>{o.lines.map(l=>l.name).join(', ')}</p>
   {o.status==='RESERVED'&&<div style={{display:'flex',gap:8}}><button style={btnStyle} disabled={busy} onClick={()=>void updateOrder(o.id,'PICKED_UP')}>Đã giao</button>{me.role==='admin'&&<button style={{...btnStyle,background:'#ad4545'}} disabled={busy} onClick={()=>void updateOrder(o.id,'CANCELLED')}>Hủy</button>}</div>}
   {o.status==='PICKED_UP'&&<button style={btnStyle} disabled={busy} onClick={()=>void updateOrder(o.id,'RETURNED')}>Đã trả → Giặt</button>}</article>)}</section>
  </div>}
 </>}
 </div></main>;
}
