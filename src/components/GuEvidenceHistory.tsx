'use client';
import {formatVNDateTime} from '@/lib/vn-datetime';
import {useEffect,useState} from 'react';
import type {ApiCall} from './GuExtras';
import type {InventoryItem,RentalOrder} from '@/lib/types';
import type {InspectionRound} from '@/lib/evidence-retention-rules';
type CycleInfo={rounds:InspectionRound[];pendingDelete:number;maxRounds:number};
export function GuEvidenceHistory({item,api,onClose}:{item:InventoryItem;api:ApiCall;onClose:()=>void}){
 const [info,setInfo]=useState<CycleInfo|null>(null),[order,setOrder]=useState<RentalOrder|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;api<CycleInfo>('v5/evidence-history/'+item.id).then(v=>{if(live)setInfo(v);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Không xem được lịch sử ảnh.');});return()=>{live=false};},[api,item.id]);
 const open=async(id:string)=>{setBusy(true);setError('');try{const r=await api<{order:RentalOrder}>('v5/orders/'+id);setOrder(r.order);}catch(e){setError(e instanceof Error?e.message:'Không tải được ảnh lượt thuê.');}finally{setBusy(false)}};
 const hand=order?.handoverProof?.items.find(x=>x.itemId===item.id)?.shots||{};
 const ret=order?.returnProof?.items.find(x=>x.itemId===item.id)?.shots||{};
 const angles=[...new Set([...Object.keys(hand),...Object.keys(ret)])];
 return <div className="modal-overlay" role="presentation"><div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Lịch sử ảnh giao nhận"><div className="modal-heading"><div><h2>Ảnh giao & nhận · {item.name}</h2><small>Mã sản phẩm: {item.hangerCode||item.sku} {item.cameraSerial?'· Serial '+item.cameraSerial:''}</small></div><button type="button" className="btn btn-white" onClick={onClose}>Đóng</button></div><div className="modal-body">

 {info&&<p><b>{info.rounds.length}/{info.maxRounds} lượt ảnh</b>{info.pendingDelete>0?' · '+info.pendingDelete+' tác vụ xóa đang chờ':''}</p>}
 {error&&<p className="field-error">{error}</p>}
 {!info&&!error&&<p>Đang tải lịch sử ảnh…</p>}
 {info?.rounds.slice().reverse().map((r,i)=><button type="button" className="gu-v5-job" key={r.orderId} disabled={busy} onClick={()=>void open(r.orderId)}><b>Lượt {info.rounds.length-i} · {formatVNDateTime(r.completedAt)}</b><span>Mở ảnh giao và ảnh nhận</span></button>)}
 {order&&<section className="gu-v5-inspection-item"><h3>{order.code} · {order.customerName}</h3><p>Giao: {order.handoverProof?.byName||'Chưa rõ'} · Nhận: {order.returnProof?.byName||'Chưa rõ'}</p>{angles.map(angle=><div key={angle} className="gu-v5-angle"><strong>{angle}</strong><div className="gu-v5-compare"><div><small>Ảnh giao</small>{hand[angle]?.url?<img src={hand[angle].url} alt={'Ảnh giao '+angle}/>:<p>Không có ảnh</p>}</div><div><small>Ảnh nhận</small>{ret[angle]?.url?<img src={ret[angle].url} alt={'Ảnh nhận '+angle}/>:<p>Không có ảnh</p>}</div></div></div>)}</section>}
 </div></div></div>;
}
