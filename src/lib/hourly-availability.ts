import {overlap,splitIntoVietnamDays} from './hourly-pricing.ts';
export type ExistingInterval={orderId:string;start:string;end:string};
/** Strict half-open interval overlap. A booking ending at 09:00 never blocks one starting at 09:00. */
export function occupiedInRange(legacyBooked:boolean,entries:readonly ExistingInterval[],from:string,to:string){
 return legacyBooked||entries.some(e=>overlap(e.start,e.end,from,to));
}
export function queryDays(from:string,to:string){return splitIntoVietnamDays(from,to);}
export function localSearchRange(pickupDate:string,returnDate:string,startHour='09:00',endHour='09:00'){
 const day=/^\d{4}-\d{2}-\d{2}$/;const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 if(!day.test(pickupDate)||!day.test(returnDate)||!clock.test(startHour)||!clock.test(endHour))throw Error('Ngày giờ tra cứu không hợp lệ.');
 // Date range is inclusive; checkout is on the day AFTER the last selected rental date.
 const next=new Date(returnDate+'T00:00:00Z');if(Number.isNaN(next.getTime()))throw Error('Ngày trả không hợp lệ.');
 next.setUTCDate(next.getUTCDate()+1);
 const endDay=next.toISOString().slice(0,10);
 const from=new Date(pickupDate+'T'+startHour+':00+07:00').toISOString();
 const to=new Date(endDay+'T'+endHour+':00+07:00').toISOString();
 return {from,to};
}
