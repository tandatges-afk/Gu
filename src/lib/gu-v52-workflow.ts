/** Rental policy shared by client previews and all V5 server actions. */
/** The paid 24h/camera package starts at physical handover, early or late.
 * The original appointment remains in scheduledPickupAt and order history.
 */
export function handoverBillingStart(input:{bookingKind?:string;scheduledPickupAt?:string|null;pickupAt?:string|null;actualHandoverAt:string}):string{
 if(!Number.isFinite(Date.parse(input.actualHandoverAt)))throw new Error('Giờ giao thực tế không hợp lệ.');
 return new Date(input.actualHandoverAt).toISOString();
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
