/** Calendar presentation states are computed for the viewed Vietnam day, never from
 * an item's present-day inventory status alone. This module is deliberately pure. */
import type {InventoryItem,RentalOrder} from './types.ts';
import {addDays} from './rental.ts';

export type CalendarDayState='FREE'|'RESERVED'|'PICKED_UP'|'RETURNED'|'OVERDUE'|'LAUNDRY'|'MAINTENANCE'|'MISSING'|'UNPRICED'|'BLOCKED';
export type CalendarOrderState={order:RentalOrder;state:CalendarDayState};
const active=(o:RentalOrder)=>!['CANCELLED','VOIDED'].includes(o.status);
export function vnDayAt(iso?:string):string|null{
 if(!iso)return null;
 const date=new Date(iso);
 return Number.isFinite(+date)?date.toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}):null;
}
const starts=(o:RentalOrder,id:string)=>{
 const line=o.lines.find(l=>l.itemId===id);
 return line?.startDate||o.pickupDate;
};
export function orderDayState(o:RentalOrder,itemId:string,day:string,today:string):CalendarDayState|null{
 if(!active(o)||!o.lines.some(l=>l.itemId===itemId))return null;
 if(starts(o,itemId)>day)return null;
 if(o.status==='RESERVED')return day<=o.returnDate?'RESERVED':null;
 if(o.status==='PICKED_UP'){
   // Physically not returned: do not declare future days available just because the booked return date expired.
   if(day>o.returnDate)return 'OVERDUE';
   return 'PICKED_UP';
 }
 if(o.status==='RETURNED'){
   const finished=vnDayAt(o.returnedAt)||o.returnDate;
   if(day>finished)return null;
   return day===finished?'RETURNED':'PICKED_UP';
 }
 return null;
}
const priority:Record<CalendarDayState,number>={OVERDUE:9,PICKED_UP:8,RESERVED:7,RETURNED:6,BLOCKED:5,LAUNDRY:4,MAINTENANCE:4,MISSING:4,UNPRICED:3,FREE:1};
export function ordersOnCalendarDay(orders:readonly RentalOrder[],itemId:string,day:string,today:string):CalendarOrderState[]{
 return orders.flatMap(o=>{
   const state=orderDayState(o,itemId,day,today);
   return state?[{order:o,state}]:[];
 }).sort((a,b)=>priority[b.state]-priority[a.state]||a.order.pickupDate.localeCompare(b.order.pickupDate)||a.order.id.localeCompare(b.order.id));
}
export function itemDayState(item:InventoryItem,orders:readonly RentalOrder[],day:string,today:string):CalendarDayState{
 const booked=ordersOnCalendarDay(orders,item.id,day,today)[0];
 if(booked)return booked.state;
 // Current inventory flags cannot be projected backwards onto historic dates.
 if(day>=today){
  if(item.status==='LAUNDRY'||item.status==='MAINTENANCE'||item.status==='MISSING')return item.status;
  if(item.status==='RENTED')return 'BLOCKED'; // Item out, even if order source is incomplete
  if(!(item.replacementValue>0))return 'UNPRICED';
 }
 return 'FREE';
}
export function weekStates(item:InventoryItem,orders:readonly RentalOrder[],start:string,today:string,days=7):Set<CalendarDayState>{
 return new Set(Array.from({length:days},(_,offset)=>itemDayState(item,orders,addDays(start,offset),today)));
}
export function matchesCalendarStatus(item:InventoryItem,orders:readonly RentalOrder[],start:string,today:string,status:string):boolean{
 if(status==='ALL')return true;
 return weekStates(item,orders,start,today).has(status as CalendarDayState);
}
export function matchesCalendarCreator(item:InventoryItem,orders:readonly RentalOrder[],start:string,today:string,creator:string):boolean{
 if(creator==='ALL')return true;
 for(let i=0;i<7;i++){
  const day=addDays(start,i);
  if(orders.some(o=>o.createdBy===creator&&orderDayState(o,item.id,day,today)!==null))return true;
 }
 return false;
}
/** The warning is a decoration, not an extra text row or a change to reservation state. */
export function isPickupWarning(o:RentalOrder,day:string,now:Date):boolean{
 if(o.status!=='RESERVED')return false;
 const vn=vnDayAt(now.toISOString());
 if(day!==vn||o.pickupDate!==day)return false;
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'}).format(now));
 if(hour<17)return false;
 const scheduled=o.scheduledPickupAt||o.pickupAt;
 return !scheduled||!Number.isFinite(Date.parse(scheduled))||now.getTime()>=Date.parse(scheduled);
}
