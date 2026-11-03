/** Rental policy shared by client previews and all V5 server actions. */
/** The paid 24h/camera package starts at physical handover, early or late.
 * The original appointment remains in scheduledPickupAt and order history.
 */
export function handoverBillingStart(input:{bookingKind?:string;scheduledPickupAt?:string|null;pickupAt?:string|null;actualHandoverAt:string}):string{
 const actual=Date.parse(input.actualHandoverAt);
 if(!Number.isFinite(actual))throw new Error('Giờ giao thực tế không hợp lệ.');
 const planned=Date.parse(input.scheduledPickupAt||input.pickupAt||'');
 // Arriving late does not extend the customer's paid interval. Arriving early starts it early.
 return new Date(Number.isFinite(planned)?Math.min(planned,actual):actual).toISOString();
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

/** A never-collected reservation expires at the paid package's scheduled end.
 * This is a pure predicate, never directly mutates money, item stock or evidence.
 */
export function noShowExpired(order:{status:string;pricingVersion?:string;pickupAt?:string;scheduledPickupAt?:string;returnAt?:string;handoverProof?:unknown;rentalGroup?:string;lines?:readonly {category?:string;cameraPackageHours?:number}[]},now:number):boolean{
 if(order.status!=='RESERVED'||order.pricingVersion!=='GU_HOURLY_V1'||Boolean(order.handoverProof))return false;
 const from=Date.parse(order.scheduledPickupAt||order.pickupAt||'');
 const to=Date.parse(order.returnAt||'');
 const pkg=order.rentalGroup==='CAMERA'?order.lines?.find(line=>Number.isFinite(line.cameraPackageHours))?.cameraPackageHours:undefined;
 const contractualEnd=pkg&&[3,6,24,48].includes(pkg)?from+pkg*3_600_000:to;
 return Number.isFinite(now)&&Number.isFinite(from)&&Number.isFinite(contractualEnd)&&contractualEnd>from&&now>=contractualEnd;
}
