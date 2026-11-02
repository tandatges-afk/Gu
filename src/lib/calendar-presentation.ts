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
export function calendarVisualState(input:{late:boolean;pickupLate?:boolean;warning:boolean;orderStatus?:string;blocked:boolean;isPast:boolean;blockedLabel?:string}):{className:CalendarVisualClass;label:string}{
 if(input.late)return {className:'stateOverdue',label:'Trả trễ'};
 if(input.pickupLate)return {className:'stateWarning',label:'Quá giờ nhận'};
 if(input.warning)return {className:'stateWarning',label:'Cảnh báo'};
 if(input.orderStatus==='PICKED_UP')return {className:'statePicked',label:'Đã lấy'};
 if(input.orderStatus==='RESERVED')return {className:'stateReserved',label:'Đã giữ'};
 if(input.blocked)return {className:'stateBlocked',label:input.blockedLabel||'Không sẵn sàng'};
 if(input.isPast)return {className:'statePast',label:'Đã qua'};
 return {className:'stateFree',label:'Còn trống'};
}

import type {InventoryItem,RentalOrder} from './types.ts';
import {cameraLateAlert} from './camera-live-status.ts';
import {overduePickupNotice,overdueReturnNotice,vnClock} from './return-risk.ts';

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
 nowMs:number=Date.now(),
){
 const isForItem=(o:RentalOrder)=>o.lines.some(l=>l.itemId===item.id);
 const matching=orders.filter(o=>
  (o.status==='RESERVED'||o.status==='PICKED_UP')&&isForItem(o)&&
  day>=o.pickupDate&&day<=o.returnDate&&
  day>=(o.lines.find(l=>l.itemId===item.id)?.startDate||o.pickupDate)
 ).sort((a,b)=>(a.status==='PICKED_UP'?0:1)-(b.status==='PICKED_UP'?0:1)||
  String(a.pickupAt||'').localeCompare(String(b.pickupAt||''))||a.id.localeCompare(b.id));
 const instant=new Date(nowMs);
 // The caller may render a historical or simulated calendar. Do not apply
 // real-time pickup/return deadlines to a different "today" reference.
 const liveClock=Number.isFinite(nowMs)&&vnClock(instant).today===today;
 const lateOrder=orders.find(o=>o.status==='PICKED_UP'&&isForItem(o)&&
  (cameraLateAlert(o,nowMs)!==null||o.returnDate<today||
   (liveClock&&overdueReturnNotice(o,instant)!==null)));
 const cameraLate=!!lateOrder&&cameraLateAlert(lateOrder,nowMs)!==null;
 // Keep the original expired-date rule, including simulated/past calendar
 // fixtures. Only today's precisely overdue returns get the new red state.
 const sameDayReturnLate=!!lateOrder&&liveClock&&lateOrder.returnDate===today&&
  overdueReturnNotice(lateOrder,instant)!==null;
 // A live overdue order is an operational alert, not a booking occupying all
 // future calendar dates. Future columns must show their own dated bookings.
 // Keep the original time-simulated fixture behavior when 'today' is synthetic.
 const wouldBeLate=!!lateOrder&&(cameraLate?day>=today:
  day>lateOrder.returnDate||(sameDayReturnLate&&day>=today))&&
  (!liveClock||day<=today);
 const latePickupOrder=liveClock?orders.find(o=>o.status==='RESERVED'&&isForItem(o)&&
  overduePickupNotice(o,instant)!==null):undefined;
 // Uncollected reservations appear as an alert only on the CURRENT day;
 // they must not appear as fake bookings on every later day.
 // Historical overdue pickup is displayed in the operational queue, never as a fake dated booking.
 // Prefer an actual upcoming RESERVED order over a previously overdue order
 // for the same item, even when that next booking is for TODAY. The unresolved
 // order remains available in the click chooser and as a visible risk marker.
 // An already-overdue physical handover may coexist with the NEXT customer's
 // reservation. Show the dated reservation, not the earlier customer's booking,
 // but do not suppress the red operational warning for the overdue return.
 // For non-live historical fixtures, retain original deterministic priority.
 const nextReservation=liveClock&&day>=today&&Boolean(lateOrder||latePickupOrder)
  ?matching.find(o=>o.status==='RESERVED'&&o.id!==latePickupOrder?.id)
  :undefined;
 const shown=liveClock?(nextReservation||matching[0]||
  (day===today?(lateOrder||latePickupOrder):undefined)):
  (matching[0]||(wouldBeLate&&lateOrder?lateOrder:undefined));
 // Return late is an alert for TODAY, never a forecast that every later day
 // will be occupied. It remains visible even when today's cell shows the next
 // reservation and the order chooser contains both customers.
 const late=Boolean(lateOrder)&&day===today&&wouldBeLate;
 // A future day can be reservable by its DATE even when today's physical item
 // is still out. Show an explicit (!) warning rather than a false 'Chưa trả'
 // reservation that blocks every date beyond the agreed return.
 const heldBeforeDay=orders.some(o=>o.status==='PICKED_UP'&&isForItem(o)&&o.returnDate<day);
 const physicallyOutWithoutBooking=item.status==='RENTED'&&matching.length===0;
 const followupRisk=liveClock&&day>=today&&(
  Boolean((lateOrder||latePickupOrder)&&shown?.id!==lateOrder?.id&&shown?.id!==latePickupOrder?.id)||
  (day>today&&(heldBeforeDay||physicallyOutWithoutBooking))
 );
 let matchingForClick=late&&lateOrder&&!matching.some(o=>o.id===lateOrder.id)?[lateOrder,...matching]:matching;
 if(liveClock&&day===today){
  // Keep both the due booking and unresolved previous booking accessible.
  for(const overdue of [lateOrder,latePickupOrder]){
   if(overdue&&!matchingForClick.some(o=>o.id===overdue.id))matchingForClick=[...matchingForClick,overdue];
  }
 }
 // Past and future dates keep only their real booking occupancy.
 const isPast=day<today;
 // A reservation missed its pickup if it was never handed over by the agreed
 // clock time. Keep its warning on EVERY date actually covered by that order
 // (including the historical pickup days), never on unrelated future days.
 // Past booked days also remain visibly uncollected, even for legacy records
 // without a reliable pickup timestamp.
 const pickupLate=liveClock&&shown?.status==='RESERVED'&&
  (isPast||overduePickupNotice(shown,instant)!==null)&&
  (day===today||matching.some(o=>o.id===shown.id));
 const warning=riskItemIds.has(item.id)&&day===today&&Boolean(shown)&&!late&&!pickupLate;
 // Physical possession blocks immediate handover TODAY. For future dates
 // the contract's interval locks are authoritative; warn but let staff inspect
 // / create a future reservation subject to the server's conflict check.
 const physicallyOut=liveClock&&day===today&&item.status==='RENTED'&&!shown;
 const blocked=!shown&&(physicallyOut||['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)||!(item.replacementValue>0));
 const visual=calendarVisualState({late,pickupLate,warning,orderStatus:shown?.status,blocked,isPast,
   blockedLabel:physicallyOut?'Chưa trả':blocked&&['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)?{
     LAUNDRY:'Đang giặt',MAINTENANCE:'Bảo trì',MISSING:'Thất lạc'
   }[item.status as 'LAUNDRY'|'MAINTENANCE'|'MISSING']:'Chưa duyệt giá'});
 return {matching:matchingForClick,shown,late,pickupLate,warning,followupRisk,blocked,isPast,visual};
}

/**
 * Inventory rows are ordered for the FIRST date currently visible in the calendar.
 *
 * Priority 1: urgency/status on that date (existing v5.4.4 rule).
 * Priority 2: keep items belonging to the SAME customer adjacent *within* a status.
 * Priority 3: most occupied DATE CELLS in the next seven visible days first.
 *
 * Example, if all items are free on 01/01: 5 booked days > 3 > 2 > 1.
 * One date with two hourly orders counts as one occupied day, while number of
 * distinct orders is used only as a tie-breaker.
 *
 * For items that are free on the first date, the earliest upcoming booking in
 * the window determines their customer group. For already occupied items use
 * the displayed booking's customer. Never group based on customer NAME: names
 * aren't unique. Missing IDs may fall back to a normalized phone number.
 *
 * Runs only against orders actually returned for the visible inventory page;
 * this function cannot sort unloaded pages or invent missing booking data.
 */
export function sortCalendarProductsForDay(
 items:readonly InventoryItem[],day:string,orders:readonly RentalOrder[],today:string,
 riskItemIds:ReadonlySet<string>=new Set<string>(),
 visibleDays=7,
):InventoryItem[]{
 const priority:Record<CalendarVisualClass,number>={
  stateOverdue:0,stateWarning:1,statePicked:2,stateReserved:3,
  stateBlocked:4,stateFree:5,statePast:6,
 };
 type Row={item:InventoryItem;rank:number;days:number;orderCount:number;firstDay:string;groupKey:string};
 type Group={rows:Row[];rank:number;totalDays:number;maxDays:number;totalOrders:number;firstDay:string;label:string};
 const byItem=new Map<string,RentalOrder[]>();
 for(const order of orders){
  if(order.status!=='RESERVED'&&order.status!=='PICKED_UP')continue;
  for(const line of order.lines){
   const existing=byItem.get(line.itemId);
   if(existing)existing.push(order);else byItem.set(line.itemId,[order]);
  }
 }
 const endDay=addDays(day,Math.max(1,Math.min(31,Math.trunc(visibleDays)||7))-1);
 const customerKey=(order:RentalOrder|undefined):string|undefined=>{
  if(!order)return;
  const id=String(order.customerId||'').trim();
  if(id)return 'customer-id:'+id;
  const phone=String(order.customerPhone||'').replace(/\D/g,'');
  return phone.length>=9?'customer-phone:'+phone:undefined;
 };
 const groups=new Map<string,Group>();
 for(const item of items){
  const itemOrders=byItem.get(item.id)||[];
  const firstSlot=calendarSlotState(item,day,itemOrders,today,riskItemIds);
  // A product with a currently overdue prior rental must remain near the top
  // even if the TODAY cell already shows the next reservation with a risk icon.
  const riskRank=firstSlot.followupRisk&&day===today&&firstSlot.shown?.status==='RESERVED'
   ?(firstSlot.matching.some(o=>o.status==='PICKED_UP')?priority.stateOverdue:priority.stateWarning)
   :undefined;
  const rank=riskRank??priority[firstSlot.visual.className];
  const bookedDays=new Set<string>();
  const bookingIds=new Set<string>();
  let nextBooking:{order:RentalOrder;day:string}|undefined;
  for(let offset=0;offset<Math.min(31,Math.max(1,Math.trunc(visibleDays)||7));offset++){
   const candidateDay=addDays(day,offset);
   const slot=offset===0?firstSlot:calendarSlotState(item,candidateDay,itemOrders,today,riskItemIds);
   if(!slot.matching.length)continue;
   bookedDays.add(candidateDay);
   for(const booking of slot.matching)bookingIds.add(booking.id);
   if(!nextBooking)nextBooking={order:slot.shown||slot.matching[0],day:candidateDay};
  }
  // The current displayed client takes precedence over a future booking.
  const anchor=firstSlot.shown||nextBooking?.order;
  const groupKey=customerKey(anchor)||'unassigned-item:'+item.id;
  const row:Row={item,rank,days:bookedDays.size,orderCount:bookingIds.size,
   firstDay:nextBooking?.day||addDays(endDay,1),groupKey};
  // Status must remain the primary grouping; a customer may have items in
  // separate states and must not move an urgent row behind an available row.
  const key=String(rank)+'|'+groupKey;
  const group=groups.get(key);
  if(group){
   group.rows.push(row);group.totalDays+=row.days;
   group.maxDays=Math.max(group.maxDays,row.days);
   group.totalOrders+=row.orderCount;
   if(row.firstDay<group.firstDay)group.firstDay=row.firstDay;
  }else groups.set(key,{rows:[row],rank,totalDays:row.days,maxDays:row.days,
   totalOrders:row.orderCount,firstDay:row.firstDay,label:groupKey});
 }
 const sortedGroups=[...groups.values()].sort((a,b)=>
  a.rank-b.rank||
  b.totalDays-a.totalDays||b.maxDays-a.maxDays||
  b.totalOrders-a.totalOrders||a.firstDay.localeCompare(b.firstDay)||
  a.label.localeCompare(b.label,'vi')
 );
 return sortedGroups.flatMap(group=>group.rows.sort((a,b)=>
  b.days-a.days||b.orderCount-a.orderCount||
  a.firstDay.localeCompare(b.firstDay)||
  a.item.name.localeCompare(b.item.name,'vi',{sensitivity:'base'})||
  String(a.item.hangerCode||'').localeCompare(String(b.item.hangerCode||''))||
  a.item.id.localeCompare(b.item.id)
 ).map(row=>row.item));
}
