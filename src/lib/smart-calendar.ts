/** Pure business-display helpers for GU Smart Rental Calendar.
 * Availability search itself is checked against rentalSlots by the server.
 */
import {addDays,daysInclusive,parseDate} from './rental.ts';
import type {InventoryItem,RentalOrder} from './types.ts';
export type CalendarFilter='ALL'|'FREE'|'RESERVED'|'PICKED_UP'|'RETURNED'|'BLOCKED'|'OVERDUE'|'LAUNDRY'|'MAINTENANCE'|'MISSING'|'UNPRICED';
export function calendarItemState(item:InventoryItem, orders:RentalOrder[], start:string, days=7, today:string):Exclude<CalendarFilter,'ALL'> {
  const end=addDays(start,days-1);
  const relevant=orders.filter(o=>['RESERVED','PICKED_UP'].includes(o.status)&&o.lines.some(l=>l.itemId===item.id));
  if(relevant.some(o=>o.status==='PICKED_UP'&&o.returnDate<today))return 'OVERDUE';
  if(item.status==='LAUNDRY'||item.status==='MAINTENANCE'||item.status==='MISSING')return item.status;
  if(relevant.some(o=>o.status==='PICKED_UP'&&o.returnDate>=start&&o.lines.some(l=>l.itemId===item.id&&(l.startDate||o.pickupDate)<=end)))return 'PICKED_UP';
  if(relevant.some(o=>o.status==='RESERVED'&&o.returnDate>=start&&o.lines.some(l=>l.itemId===item.id&&(l.startDate||o.pickupDate)<=end)))return 'RESERVED';
  if(!(item.replacementValue>0))return 'UNPRICED';
  return 'FREE';
}
export function validateSmartRange(start:string,end:string,today:string):number {
  const n=daysInclusive(start,end);
  parseDate(today);
  if(start<today)throw new Error('Không thể tìm lịch trống cho ngày đã qua.');
  if(start>addDays(today,365))throw new Error('Chỉ tra cứu trong 12 tháng tới.');
  return n;
}
export function nearestFreeStart(start:string,rentalDays:number,occupiedDates:ReadonlySet<string>,maxLookaheadDays=90):string|null {
  if(!Number.isInteger(rentalDays)||rentalDays<1||rentalDays>30)throw new Error('Thời gian thuê phải từ 1 đến 30 ngày.');
  for(let offset=0;offset<=maxLookaheadDays;offset++){
    const candidate=addDays(start,offset);
    let free=true;
    for(let j=0;j<rentalDays;j++) if(occupiedDates.has(addDays(candidate,j))){free=false;break;}
    if(free)return candidate;
  }
  return null;
}
