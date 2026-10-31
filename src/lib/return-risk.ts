import type {RentalOrder} from './types';

/** 20:00 Vietnam time; shared by API, dashboard and calendar risk detection. */
export const NEXT_DAY_RISK_START_HOUR_VN=20;
/** Local VN policy: from 20:00, highlight items still with a customer and booked tomorrow.
 * Business data must be queried from server (not just the most recent dashboard page).
 */
export function vnClock(now:Date){const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 const parts=Object.fromEntries(fmt.formatToParts(now).map(p=>[p.type,p.value]));return {today:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
}
export function nextDay(date:string){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function tomorrowReturnRisk(orders:RentalOrder[],now:Date):{itemId:string;heldOrderId:string;nextOrderId:string}[]{
 const {today,hour}=vnClock(now);if(hour<NEXT_DAY_RISK_START_HOUR_VN)return [];
 const tomorrow=nextDay(today);
 const held=orders.filter(o=>o.status==='PICKED_UP');
 const next=orders.filter(o=>o.status==='RESERVED'&&o.pickupDate===tomorrow);
 return held.flatMap(h=>h.lines.flatMap(line=>next.filter(n=>n.id!==h.id&&n.lines.some(l=>l.itemId===line.itemId)).map(n=>({itemId:line.itemId,heldOrderId:h.id,nextOrderId:n.id}))));
}

/** Customers who have not arrived after their agreed pickup time.
 * Missing clock times on legacy orders are NOT treated as midnight pickups.
 * Instead, notify only when their scheduled calendar day has fully passed.
 * Called on the server for the complete set of open reservations.
 */
export type LatePickupAlert={orderId:string;code:string;customerName:string;scheduledAt:string|null;pickupDate:string};
export function overduePickupNotice(order:RentalOrder,now:Date):LatePickupAlert|null{
 if(order.status!=='RESERVED')return null;
 const planned=order.scheduledPickupAt||order.pickupAt;
 if(planned && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(planned) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(planned)){
  const at=Date.parse(planned);
  if(Number.isFinite(at))return now.getTime()>at?{orderId:order.id,code:order.code,customerName:order.customerName,scheduledAt:planned,pickupDate:order.pickupDate}:null;
 }
 // Legacy date-only orders: not enough information to call them late during their pickup day.
 if(/^\d{4}-\d{2}-\d{2}$/.test(order.pickupDate||'') && order.pickupDate<vnClock(now).today){
  return {orderId:order.id,code:order.code,customerName:order.customerName,scheduledAt:null,pickupDate:order.pickupDate};
 }
 return null;
}
/** Visual-only return alert. Never changes billing, status or the scheduled return.
 * Clothing/accessory deadlines use the persisted handover-adjusted returnAt.
 * Camera uses the existing specialized cameraLateAlert in calendar/dashboard.
 * Legacy date-only records are not treated as late until the next Vietnam day.
 */
export type LateReturnAlert={orderId:string;code:string;customerName:string;scheduledAt:string|null;returnDate:string};
export function overdueReturnNotice(order:RentalOrder,now:Date):LateReturnAlert|null{
 if(order.status!=='PICKED_UP')return null;
 if(order.rentalGroup==='CAMERA'||order.lines.some(l=>Boolean(l.cameraModel||l.cameraPackageHours)))return null;
 const planned=order.returnAt;
 if(planned && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(planned) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(planned)){
  const at=Date.parse(planned);
  if(Number.isFinite(at))return now.getTime()>at?{orderId:order.id,code:order.code,customerName:order.customerName,scheduledAt:planned,returnDate:order.returnDate}:null;
 }
 if(/^\d{4}-\d{2}-\d{2}$/.test(order.returnDate||'') && order.returnDate<vnClock(now).today){
  return {orderId:order.id,code:order.code,customerName:order.customerName,scheduledAt:null,returnDate:order.returnDate};
 }
 return null;
}
export function overdueReturnNotices(orders:RentalOrder[],now:Date):LateReturnAlert[]{
 return orders.map(o=>overdueReturnNotice(o,now)).filter((row):row is LateReturnAlert=>row!==null)
  .sort((a,b)=>(a.scheduledAt||a.returnDate).localeCompare(b.scheduledAt||b.returnDate)||a.orderId.localeCompare(b.orderId));
}
export function overduePickupNotices(orders:RentalOrder[],now:Date):LatePickupAlert[]{
 return orders.map(o=>overduePickupNotice(o,now)).filter((row):row is LatePickupAlert=>row!==null)
  .sort((a,b)=>(a.scheduledAt||a.pickupDate).localeCompare(b.scheduledAt||b.pickupDate)||a.orderId.localeCompare(b.orderId));
}
