/** Live display estimate only. The completed return transaction remains authoritative. */
import type {RentalOrder} from './types.ts';
import {orderGroup} from './order-group.ts';
import {cameraQuoteForLine,isCameraCategory} from './camera-rental.ts';
const MINUTE=60_000;

export type CameraLateAlert={lateMinutes:number;scheduledReturnAt:string};
export function cameraLateAlert(order:RentalOrder,now:number|string):CameraLateAlert|null{
 if(order.status!=='PICKED_UP'||orderGroup(order)!=='CAMERA')return null;
 const scheduledDue=Date.parse(order.returnAt||'');
 const current=typeof now==='number'?now:Date.parse(now);
 if(!Number.isFinite(scheduledDue)||!Number.isFinite(current))return null;
 // The contractual return may be later than the selected 3h/6h camera tier.
 // If the camera is handed over early, its paid package can expire before
 // that scheduled return. Warn at the FIRST of those deadlines.
 const packageDeadlines=order.lines.flatMap(line=>{
  const start=Date.parse(line.startAt||order.scheduledPickupAt||order.pickupAt||'');
  const hours=Number(line.cameraPackageHours);
  return Number.isFinite(start)&&Number.isFinite(hours)&&hours>0?[start+hours*60*MINUTE]:[];
 });
 const due=Math.min(scheduledDue,...packageDeadlines);
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
   // Each line stores the actual physical handover as its billing start
   // for orders handed over after Rev7.8. Historical orders retain their
   // existing startAt without retroactively changing agreed payments.
   const startedAt=line.startAt||order.scheduledPickupAt||order.pickupAt||order.handoverProof?.at;
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
