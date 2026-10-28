import {db} from './firebase-admin';
import {ApiError} from './http';
import {vnDayKey,overlap,splitIntoVietnamDays} from './hourly-pricing';
import type {RentalOrder,InventoryItem} from './types';
import type {Transaction, DocumentReference} from '@/lib/pg-firestore';
export type IntervalEntry={orderId:string;start:string;end:string};
export type IntervalRef={itemId:string;day:string;ref:DocumentReference;start:string;end:string};
export const simpleId=(id:string)=>/^[\w-]{10,128}$/.test(id);
export function intervalRefs(items:string[],from:string,to:string):IntervalRef[]{
 const days=splitIntoVietnamDays(from,to);
 const slots=items.flatMap(itemId=>days.map(day=>({itemId,day:day.key,start:day.start,end:day.end,ref:db().collection('v5DayIntervals').doc(itemId+'_'+day.key)})));
 if(slots.length>300)throw new ApiError(400,'Đơn có quá nhiều sản phẩm hoặc ngày thuê; tách thành nhiều đơn nhỏ hơn.');
 return slots;
}
export async function checkIntervalAvailability(tx:Transaction,slots:IntervalRef[],orderId?:string){
 const prior=await Promise.all(slots.map(s=>tx.get(s.ref)));
 const legacy=await Promise.all(slots.map(s=>tx.get(db().collection('rentalSlots').doc(s.itemId+'__'+s.day))));
 for(let i=0;i<slots.length;i++){
  const active=(prior[i].data()?.entries||[]) as IntervalEntry[];
  if(active.some(p=>p.orderId!==orderId&&overlap(p.start,p.end,slots[i].start,slots[i].end))||
   (legacy[i].exists&&legacy[i].data()?.orderId!==orderId))throw new ApiError(409,'Sản phẩm đã được giữ trong khoảng giờ đã chọn.',{itemId:slots[i].itemId,day:slots[i].day});
 }
 return prior;
}
export function createIntervalWrites(tx:Transaction,slots:IntervalRef[],prior:Awaited<ReturnType<typeof checkIntervalAvailability>>,orderId:string){
 slots.forEach((s,i)=>{
  const entries=[...((prior[i].data()?.entries||[]) as IntervalEntry[])];
  entries.push({orderId,start:s.start,end:s.end});
  tx.set(s.ref,{itemId:s.itemId,day:s.day,entries,updatedAt:new Date().toISOString()});
 });
}
/** Change a RESERVED order to its actual pickup+package slot atomically.
 * Read every old/new day and legacy lock before writing anything; keep other orders.
 */
export async function rebaseHandoverIntervals(tx:Transaction,order:RentalOrder,newStart:string,newEnd:string){
 if(!order.pickupAt||!order.returnAt)throw new ApiError(409,'Đơn thiếu giờ nhận hoặc giờ trả gốc.');
 const itemIds=order.lines.map(line=>line.itemId);
 const original=intervalRefs(itemIds,order.pickupAt,order.returnAt);
 const incoming=intervalRefs(itemIds,newStart,newEnd);
 const keys=new Map<string,IntervalRef>();
 for(const slot of [...original,...incoming])keys.set(slot.ref.path,slot);
 const slots=[...keys.values()];
 const snapshots=await Promise.all(slots.map(slot=>tx.get(slot.ref)));
 const legacy=await Promise.all(incoming.map(slot=>tx.get(db().collection('rentalSlots').doc(slot.itemId+'__'+slot.day))));
 for(let i=0;i<incoming.length;i++){
  const slot=incoming[i];
  const snapshot=snapshots[slots.findIndex(entry=>entry.ref.path===slot.ref.path)];
  const active=(snapshot.data()?.entries||[]) as IntervalEntry[];
  if(active.some(other=>other.orderId!==order.id&&overlap(other.start,other.end,slot.start,slot.end)) ||
   (legacy[i].exists && legacy[i].data()?.orderId!==order.id))
   throw new ApiError(409,'Giờ trả mới sau khi nhận thực tế trùng đơn khác. Không thể bàn giao; hãy điều chỉnh lịch trước.',{itemId:slot.itemId,day:slot.day});
 }
 const fresh=new Map(incoming.map(slot=>[slot.ref.path,slot]));
 return ()=>slots.forEach((slot,i)=>{
  const prior=snapshots[i];
  const remaining=((prior.data()?.entries||[]) as IntervalEntry[]).filter(entry=>entry.orderId!==order.id);
  const next=fresh.get(slot.ref.path);
  const entries=next?[...remaining,{orderId:order.id,start:next.start,end:next.end}]:remaining;
  if(entries.length)tx.set(slot.ref,{itemId:slot.itemId,day:slot.day,entries,updatedAt:new Date().toISOString()});
  else if(prior.exists)tx.delete(slot.ref);
 });
}
export async function removeOrderIntervals(tx:Transaction,order:RentalOrder){
 if(!order.pickupAt||!order.returnAt)return;
 // Early pickup creates extra interval locks before the original slot.
 // Release both the early and contracted parts, so availability is restored.
 const starts=[order.pickupAt,...order.lines.map(l=>l.startAt)].filter((v):v is string=>Boolean(v)&&Number.isFinite(Date.parse(v!)));
 const from=starts.reduce((a,b)=>Date.parse(a)<Date.parse(b)?a:b,order.pickupAt);
 const slots=intervalRefs(order.lines.map(l=>l.itemId),from,order.returnAt);
 const prior=await Promise.all(slots.map(s=>tx.get(s.ref)));
 return ()=>slots.forEach((s,i)=>{
  const entries=((prior[i].data()?.entries||[]) as IntervalEntry[]).filter(x=>x.orderId!==order.id);
  if(prior[i].exists){if(entries.length)tx.set(s.ref,{itemId:s.itemId,day:s.day,entries,updatedAt:new Date().toISOString()});else tx.delete(s.ref);}
 });
}
export function requiredTemplates(order:RentalOrder):Record<string,string[]>{return order.photoTemplates||Object.fromEntries(order.lines.map(l=>[l.itemId,[]]));}
export function currentItemStatus(item:InventoryItem,orderId:string){return item.currentOrderId===orderId||item.status==='AVAILABLE';}
