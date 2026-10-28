/** Rental policy shared by client previews and all V5 server actions. */
/**
 * A scheduled pickup is billable from the earlier of its agreed time and the
 * actual handover. Customers arriving late do not push the clock forward;
 * customers receiving stock early start being billed at that earlier handover.
 * The physical handover remains recorded separately in handoverProof.at.
 * Applicable to both camera and clothing/accessory calendars, including a
 * same-day booking stored as WALK_IN.
 */
export function handoverBillingStart(input:{bookingKind?:string;scheduledPickupAt?:string|null;pickupAt?:string|null;actualHandoverAt:string}):string{
 const scheduled=input.scheduledPickupAt||input.pickupAt;
 const actual=Date.parse(input.actualHandoverAt);
 const planned=scheduled?Date.parse(scheduled):NaN;
 if(!Number.isFinite(actual))throw new Error('Giờ giao thực tế không hợp lệ.');
 if(!Number.isFinite(planned))return input.actualHandoverAt;
 return new Date(Math.min(planned,actual)).toISOString();
}
export function requiresFullPrepayment(pickupAt:string, createdAt:string, requestedReserve=false){
 const localDay=(s:string)=>new Date(s).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 return requestedReserve || localDay(pickupAt)>localDay(createdAt);
}
export function finalRent(input:{bookedRent:number;quotedRent:number;prepaid:boolean;scheduledReturn:string;actualReturn:string}){
 const {bookedRent,quotedRent,prepaid,scheduledReturn,actualReturn}=input;
 if(!Number.isSafeInteger(bookedRent)||bookedRent<0||!Number.isSafeInteger(quotedRent)||quotedRent<0)throw Error('Giá thuê không hợp lệ');
 // A prepaid reservation never loses its agreed price when returned early.
 // But early physical pickup STARTS the paid period early: crossing the chosen
 // camera tier or a 24h block still creates a real charge, even if returned
 // before the originally scheduled deadline.
 return prepaid?Math.max(bookedRent,quotedRent):quotedRent;
}
export function amountRemaining(total:number,paid:number,other=0,compensation=0){
 return Math.max(0,total+other+compensation-paid);
}
export function vnClock(iso?:string){
 if(!iso)return '--:--';const d=new Date(iso);return Number.isNaN(+d)?'--:--':d.toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false});
}
