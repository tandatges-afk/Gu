import type {RentalOrder} from './types.ts';
import {vnClock} from './return-risk.ts';

/** UI-only alert. Never mutates a reservation, its interval locks, or deposit. */
export function hasMissedPickupAt17(order:RentalOrder,now:Date):boolean {
  if(order.status!=='RESERVED')return false;
  const {today,hour}=vnClock(now);
  if(order.pickupDate!==today||hour<17)return false;
  // A reservation scheduled after 17:00 must not be flagged prematurely.
  const due=order.scheduledPickupAt||order.pickupAt;
  if(due){const dueTimestamp=Date.parse(due);if(Number.isFinite(dueTimestamp)&&now.getTime()<dueTimestamp)return false;}
  return true;
}

/** Exclude historical/void orders; prefer a currently checked-out order if rows overlap. */
export function calendarOrdersForDay(orders:RentalOrder[],itemId:string,day:string):RentalOrder[] {
  return orders.filter(order=>
    (order.status==='RESERVED'||order.status==='PICKED_UP')&&
    order.pickupDate<=day&&day<=order.returnDate&&
    order.lines.some(line=>line.itemId===itemId&&(line.startDate||order.pickupDate)<=day))
    .sort((a,b)=>Number(b.status==='PICKED_UP')-Number(a.status==='PICKED_UP')||a.pickupDate.localeCompare(b.pickupDate)||a.id.localeCompare(b.id));
}

/** Checked-out and already past due. Treat as unavailable from today onward. */
export function overdueHeldOrder(orders:RentalOrder[],itemId:string,today:string):RentalOrder|undefined {
  return orders.filter(order=>order.status==='PICKED_UP'&&order.returnDate<today&&order.lines.some(line=>line.itemId===itemId))
    .sort((a,b)=>b.returnDate.localeCompare(a.returnDate))[0];
}
