/** Privacy-safe status / upcoming booking labels for the image finder. */
import type {ItemStatus,RentalOrder} from './types';
import {vnDayKey} from './hourly-pricing.ts';

export type VisualUpcoming = {orderId:string;pickupAt:string|null;returnAt:string|null;pickupDate:string;returnDate:string};
export type VisualAvailabilityState = {status:ItemStatus|'UNKNOWN';upcoming:VisualUpcoming[]};
export function vietnamDayPlus(day:string,count:number){
 const instant=new Date(day+'T00:00:00.000Z');
 if(Number.isNaN(instant.valueOf()))throw new Error('Ngày không hợp lệ.');
 instant.setUTCDate(instant.getUTCDate()+count);
 return instant.toISOString().slice(0,10);
}
export function visualUpcomingForItem(orders:readonly RentalOrder[],itemId:string,now:Date):VisualUpcoming[]{
 const today=vnDayKey(now.toISOString());
 const stopDay=vietnamDayPlus(today,7);
 const stopMillis=Date.parse(stopDay+'T00:00:00+07:00');
 const results:VisualUpcoming[]=[];
 const seen=new Set<string>();
 for(const order of orders){
  if(!['RESERVED','PICKED_UP'].includes(order.status)||seen.has(order.id)||!order.lines?.some(l=>l.itemId===itemId))continue;
  const timestamp=order.pickupAt?Date.parse(order.pickupAt):NaN;
  if(Number.isFinite(timestamp)){
   if(timestamp<now.valueOf()||timestamp>=stopMillis)continue;
  }else if(!order.pickupDate||order.pickupDate<today||order.pickupDate>=stopDay)continue;
  seen.add(order.id);
  results.push({orderId:order.id,pickupAt:Number.isFinite(timestamp)?order.pickupAt!:null,returnAt:order.returnAt&&Number.isFinite(Date.parse(order.returnAt))?order.returnAt:null,pickupDate:order.pickupDate,returnDate:order.returnDate});
 }
 return results.sort((a,b)=>((a.pickupAt||a.pickupDate).localeCompare(b.pickupAt||b.pickupDate)));
}
export function visibleStockLabel(status:ItemStatus|'UNKNOWN'){
 return status==='AVAILABLE'?'Còn trống':status==='RENTED'?'Đang thuê':status==='LAUNDRY'?'Đang giặt':status==='MAINTENANCE'?'Bảo trì':status==='MISSING'?'Thất lạc':'Chưa xác minh';
}
