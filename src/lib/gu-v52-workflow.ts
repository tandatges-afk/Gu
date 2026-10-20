/** Rental policy shared by client previews and all V5 server actions. */
/**
 * A pre-booked rental starts at the time the customer agreed to, even if the
 * handover photos are taken hours later. A walk-in begins at actual handover.
 * The actual handover remains available separately as handoverProof.at.
 */
export function handoverBillingStart(input:{bookingKind?:string;scheduledPickupAt?:string|null;pickupAt?:string|null;actualHandoverAt:string}):string{
 if(input.bookingKind!=='RESERVE')return input.actualHandoverAt;
 return input.scheduledPickupAt||input.pickupAt||input.actualHandoverAt;
}
export function requiresFullPrepayment(pickupAt:string, createdAt:string, requestedReserve=false){
 const localDay=(s:string)=>new Date(s).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 return requestedReserve || localDay(pickupAt)>localDay(createdAt);
}
export function finalRent(input:{bookedRent:number;quotedRent:number;prepaid:boolean;scheduledReturn:string;actualReturn:string}){
 const {bookedRent,quotedRent,prepaid,scheduledReturn,actualReturn}=input;
 if(!Number.isSafeInteger(bookedRent)||bookedRent<0||!Number.isSafeInteger(quotedRent)||quotedRent<0)throw Error('Giá thuê không hợp lệ');
 // Full prepayment pays for the reserved period, even if items are returned early.
 if(prepaid && Date.parse(actualReturn)<=Date.parse(scheduledReturn))return bookedRent;
 return prepaid?Math.max(bookedRent,quotedRent):quotedRent;
}
export function amountRemaining(total:number,paid:number,other=0,compensation=0){
 return Math.max(0,total+other+compensation-paid);
}
export function vnClock(iso?:string){
 if(!iso)return '--:--';const d=new Date(iso);return Number.isNaN(+d)?'--:--':d.toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false});
}
