/** Live display estimate only. The completed return transaction remains authoritative. */
import type {RentalOrder} from './types.ts';
import {orderGroup} from './order-group.ts';
import {cameraQuoteForLine,isCameraCategory} from './camera-rental.ts';
const MINUTE=60_000;

export type CameraLateAlert={lateMinutes:number;scheduledReturnAt:string};
export function cameraLateAlert(order:RentalOrder,now:number|string):CameraLateAlert|null{
 if(order.status!=='PICKED_UP'||orderGroup(order)!=='CAMERA')return null;
 const due=Date.parse(order.returnAt||'');
 const current=typeof now==='number'?now:Date.parse(now);
 if(!Number.isFinite(due)||!Number.isFinite(current))return null;
 const overdueMinutes=Math.floor(current/MINUTE)-Math.floor(due/MINUTE);
 if(overdueMinutes<=0)return null;
 return {lateMinutes:overdueMinutes,scheduledReturnAt:order.returnAt!};
}

export type CameraLiveQuote={total:number;rent:number;unpaid:number;lateFee:number;lateMinutes:number};
/** Estimate the fee from the original package snapshots and actual handover time.
 * Do not persist or charge this estimate: the real return timestamp is captured in RECEIVE.
 * Return null for historical/invalid camera pricing rather than inventing a fee. */
export function cameraLiveQuote(order:RentalOrder,now:number|string):CameraLiveQuote|null{
 const alert=cameraLateAlert(order,now);
 if(!alert)return null;
 const current=typeof now==='number'?now:Date.parse(now);
 const endedAt=new Date(current).toISOString();
 let rent=0,lateFee=0,seen=0;
 try{
  for(const line of order.lines){
   if(!isCameraCategory(line.category||''))return null;
   // Mirror the RECEIVE server action: overdue pre-bookings bill from the
   // agreed pickup time, even when handover was photographed later.
   const startedAt=order.bookingKind==='RESERVE'
    ? (order.scheduledPickupAt||order.pickupAt||line.startAt)
    : (line.startAt||order.handoverProof?.at||order.pickupAt);
   if(!startedAt||Date.parse(startedAt)>=current)return null;
   const quote=cameraQuoteForLine(line,startedAt,endedAt);
   rent+=quote.amount;lateFee+=quote.lateFee;seen++;
  }
  if(!seen||!Number.isSafeInteger(rent)||!Number.isSafeInteger(lateFee))return null;
  const total=Math.max(order.total,rent);
  const unpaid=Math.max(0,total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid);
  return {total,rent,unpaid,lateFee,lateMinutes:alert.lateMinutes};
 }catch{return null;}
}
