'use client';
import {useMemo,useState} from 'react';
import {AlertCircle,ArrowRight,ChevronDown,PhoneCall,RefreshCcw,Search,Wallet} from 'lucide-react';
import type {DebtSummary} from '@/lib/debts';
import {money} from '@/lib/rental';
const day=(v:string)=>v?.split('-').reverse().join('/')||'—';
export function GuDebts({summary,loading,error,onRefresh,onOpen}:{
 summary:DebtSummary|null;loading:boolean;error:string;onRefresh:()=>void;onOpen:(id:string)=>void;
}){
 const [query,setQuery]=useState('');
 const [onlyReturned,setOnlyReturned]=useState(false);
 const accounts=useMemo(()=>summary?.accounts.map(a=>({
  ...a,orders:onlyReturned?a.orders.filter(o=>o.status==='RETURNED'):a.orders
 })).filter(a=>a.orders.length>0).filter(a=>{
  const q=query.trim().toLocaleLowerCase('vi-VN');
  return !q||[a.customerName,a.customerPhone,...a.orders.map(o=>o.code)].some(x=>x.toLocaleLowerCase('vi-VN').includes(q));
 })||[],[summary,query,onlyReturned]);
 const visibleTotal=accounts.reduce((sum,a)=>sum+a.orders.reduce((s,o)=>s+o.outstanding,0),0);
 const visibleOrders=accounts.reduce((s,a)=>s+a.orders.length,0);
 return <>
  <div className="page-intro gu-page-header"><div><div className="eyebrow">THANH TOÁN · ADMIN</div><h1>Công nợ theo khách hàng</h1></div><div className="gu-header-actions"><button className="btn btn-white" type="button" onClick={onRefresh} disabled={loading}><RefreshCcw size={16}/> Làm mới công nợ</button></div></div>
  <div className="gu-debt-metrics">
   <div><small>Cần thu từ khách đã nhận đồ</small><strong>{summary?money(summary.totalOutstanding):'—'}</strong><span>Không tính đơn chỉ mới đặt trước</span></div>
   <div><small>Khách cần thu/đối soát</small><strong>{summary?.accounts.length??'—'}</strong><span>Gộp theo tài khoản khách hàng</span></div>
   <div><small>Đơn cần thu/đối soát</small><strong>{summary?.unpaidOrders??'—'}</strong><span>{summary?.pendingCameraLateCount||0} đơn máy ảnh chưa chốt phí trễ</span></div>
   <div className="gu-debt-pending"><small>Đặt trước chưa thu (dự kiến)</small><strong>{summary?money(summary.reservationUnpaid):'—'}</strong><span>{summary?.futureReservations??0} đơn giữ lịch, không ghi là công nợ</span></div>
  </div>
  {error&&<div className="inline-alert danger-alert" role="alert"><AlertCircle size={18}/>{error}</div>}
  <section className="panel gu-debt-panel" aria-label="Danh sách công nợ">
   <div className="gu-debt-toolbar"><div className="gu-search-wrap"><Search size={17}/><input type="search" className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên khách, số điện thoại hoặc mã đơn…" aria-label="Tìm công nợ"/></div><label className="gu-debt-toggle"><input type="checkbox" checked={onlyReturned} onChange={e=>setOnlyReturned(e.target.checked)}/> Chỉ đơn đã trả đồ</label></div>
   <div className="gu-debt-count">{loading?'Đang đối soát dữ liệu…':`${accounts.length} khách · ${visibleOrders} đơn · ${money(visibleTotal)} trong bộ lọc`}</div>
   {!loading&&!accounts.length&&<div className="gu-debt-empty"><Wallet size={23}/><strong>{summary?'Không tìm thấy khách cần thu hoặc đối soát trong bộ lọc.':'Chưa có dữ liệu công nợ.'}</strong><span>Hãy thử đổi từ khóa hoặc bỏ bộ lọc.</span></div>}
   <div className="gu-debt-accounts">{accounts.map(account=><details className="gu-debt-account" key={account.key} open={accounts.length===1?true:undefined}>
    <summary><span className="gu-debt-avatar" aria-hidden="true">{account.customerName.trim().slice(0,1).toLocaleUpperCase('vi-VN')}</span><span className="gu-debt-customer"><strong>{account.customerName}</strong><small>{account.customerPhone||'Chưa có SĐT'} · {account.orders.length} đơn cần thu/đối soát</small></span><span className="gu-debt-balance"><small>Còn nợ</small><strong>{money(account.orders.reduce((s,o)=>s+o.outstanding,0))}</strong></span><ChevronDown className="gu-debt-chevron" size={18}/></summary>
    <div className="gu-debt-orders">{account.orders.map(o=><div className="gu-debt-order" key={o.id}><div className="gu-debt-order-main"><b>{o.code}</b><span>{o.status==='RETURNED'?'Đã trả đồ':'Đang thuê'} · Hẹn trả {day(o.returnDate)}{o.cameraLateFeePending?' · CHƯA CHỐT PHÍ TRỄ MÁY ẢNH':''}</span><small>{o.cameraBasePrice?`Giá gói ${money(o.cameraBasePrice)}${o.cameraOvertimeFeeTotal?' · Phí trễ '+money(o.cameraOvertimeFeeTotal):''} · `:''}Phải thu {money(o.amount)} · Đã thu {money(o.paid)}</small></div><strong>{money(o.outstanding)}</strong><div className="gu-debt-order-actions"><button type="button" className="btn btn-white" onClick={()=>onOpen(o.id)}>Mở đơn <ArrowRight size={15}/></button>{account.customerPhone&&<a className="btn btn-call" href={'tel:'+account.customerPhone.replace(/[^+0-9]/g,'')}><PhoneCall size={16}/> Gọi khách</a>}</div></div>)}</div>
   </details>)}</div>
  </section>

 </>;
}
