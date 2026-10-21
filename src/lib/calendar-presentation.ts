import {addDays} from './rental.ts';

export type CalendarDayTone='toneToday'|'toneTomorrow'|'toneAfterTomorrow'|null;
/** Compare absolute ISO day keys, not the displayed column index. */
export function calendarDayTone(day:string,today:string):CalendarDayTone{
 if(day===today)return 'toneToday';
 if(day===addDays(today,1))return 'toneTomorrow';
 if(day===addDays(today,2))return 'toneAfterTomorrow';
 return null;
}

export type CalendarVisualClass='stateWarning'|'stateOverdue'|'statePicked'|'stateReserved'|'stateBlocked'|'statePast'|'stateFree';
export function calendarVisualState(input:{late:boolean;warning:boolean;orderStatus?:string;blocked:boolean;isPast:boolean;blockedLabel?:string}):{className:CalendarVisualClass;label:string}{
 if(input.late)return {className:'stateOverdue',label:'Trả trễ'};
 if(input.warning)return {className:'stateWarning',label:'Cảnh báo'};
 if(input.orderStatus==='PICKED_UP')return {className:'statePicked',label:'Đã lấy'};
 if(input.orderStatus==='RESERVED')return {className:'stateReserved',label:'Đã giữ'};
 if(input.blocked)return {className:'stateBlocked',label:input.blockedLabel||'Không sẵn sàng'};
 if(input.isPast)return {className:'statePast',label:'Đã qua'};
 return {className:'stateFree',label:'Còn trống'};
}

import type {InventoryItem,RentalOrder} from './types.ts';

/**
 * One source of truth for the desktop and mobile calendar cells AND for sorting.
 * A product can have several non-overlapping camera rentals on the same date.
 * Display the active handover first, then a reservation; preserve the entire
 * matching list so a click still opens the choice dialog when needed.
 */
export function calendarSlotState(
 item:InventoryItem,
 day:string,
 orders:readonly RentalOrder[],
 today:string,
 riskItemIds:ReadonlySet<string>=new Set<string>(),
){
 const isForItem=(o:RentalOrder)=>o.lines.some(l=>l.itemId===item.id);
 const matching=orders.filter(o=>
  (o.status==='RESERVED'||o.status==='PICKED_UP')&&isForItem(o)&&
  day>=o.pickupDate&&day<=o.returnDate&&
  day>=(o.lines.find(l=>l.itemId===item.id)?.startDate||o.pickupDate)
 ).sort((a,b)=>(a.status==='PICKED_UP'?0:1)-(b.status==='PICKED_UP'?0:1)||
  String(a.pickupAt||'').localeCompare(String(b.pickupAt||''))||a.id.localeCompare(b.id));
 const lateOrder=orders.find(o=>o.status==='PICKED_UP'&&o.returnDate<today&&isForItem(o));
 const shown=matching[0]||(lateOrder&&day>=lateOrder.pickupDate?lateOrder:undefined);
 const late=!!lateOrder&&day>lateOrder.returnDate;
 const warning=riskItemIds.has(item.id)&&day===today&&Boolean(shown)&&!late;
 const blocked=!shown&&(['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)||!(item.replacementValue>0));
 const isPast=day<today;
 const visual=calendarVisualState({late,warning,orderStatus:shown?.status,blocked,isPast,
   blockedLabel:blocked&&['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)?{
     LAUNDRY:'Đang giặt',MAINTENANCE:'Bảo trì',MISSING:'Thất lạc'
   }[item.status as 'LAUNDRY'|'MAINTENANCE'|'MISSING']:'Chưa duyệt giá'});
 return {matching,shown,late,warning,blocked,isPast,visual};
}

/** Group by the first VISIBLE day, so clicking next/previous changes grouping.
 * Lower priority = more urgent. Ties are stable by name, product code and id.
 * The helper intentionally never mutates inventory data or the input array.
 */
export function sortCalendarProductsForDay(
 items:readonly InventoryItem[],day:string,orders:readonly RentalOrder[],today:string,
 riskItemIds:ReadonlySet<string>=new Set<string>(),
):InventoryItem[]{
 const priority:Record<CalendarVisualClass,number>={
  stateOverdue:0,stateWarning:1,statePicked:2,stateReserved:3,
  stateBlocked:4,stateFree:5,statePast:6,
 };
 const ranks=new Map(items.map(item=>[item.id,priority[calendarSlotState(item,day,orders,today,riskItemIds).visual.className]]));
 return [...items].sort((a,b)=>(ranks.get(a.id)??99)-(ranks.get(b.id)??99)||
   a.name.localeCompare(b.name,'vi',{sensitivity:'base'})||
   String(a.hangerCode||'').localeCompare(String(b.hangerCode||''))||a.id.localeCompare(b.id));
}
