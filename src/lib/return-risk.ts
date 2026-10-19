import type {RentalOrder} from './types';
/** Local VN policy: after 17:00, highlight items still with a customer and booked tomorrow.
 * Business data must be queried from server (not just the most recent dashboard page).
 */
export function vnClock(now:Date){const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 const parts=Object.fromEntries(fmt.formatToParts(now).map(p=>[p.type,p.value]));return {today:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
}
export function nextDay(date:string){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function tomorrowReturnRisk(orders:RentalOrder[],now:Date):{itemId:string;heldOrderId:string;nextOrderId:string}[]{
 const {today,hour}=vnClock(now);if(hour<17)return [];
 const tomorrow=nextDay(today);
 const held=orders.filter(o=>o.status==='PICKED_UP');
 const next=orders.filter(o=>o.status==='RESERVED'&&o.pickupDate===tomorrow);
 return held.flatMap(h=>h.lines.flatMap(line=>next.filter(n=>n.id!==h.id&&n.lines.some(l=>l.itemId===line.itemId)).map(n=>({itemId:line.itemId,heldOrderId:h.id,nextOrderId:n.id}))));
}
