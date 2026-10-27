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
export async function removeOrderIntervals(tx:Transaction,order:RentalOrder){
 if(!order.pickupAt||!order.returnAt)return;
 const slots=intervalRefs(order.lines.map(l=>l.itemId),order.pickupAt,order.returnAt);
 const prior=await Promise.all(slots.map(s=>tx.get(s.ref)));
 return ()=>slots.forEach((s,i)=>{
  const entries=((prior[i].data()?.entries||[]) as IntervalEntry[]).filter(x=>x.orderId!==order.id);
  if(prior[i].exists){if(entries.length)tx.set(s.ref,{itemId:s.itemId,day:s.day,entries,updatedAt:new Date().toISOString()});else tx.delete(s.ref);}
 });
}
export function requiredTemplates(order:RentalOrder):Record<string,string[]>{return order.photoTemplates||Object.fromEntries(order.lines.map(l=>[l.itemId,[]]));}
export function currentItemStatus(item:InventoryItem,orderId:string){return item.currentOrderId===orderId||item.status==='AVAILABLE';}
