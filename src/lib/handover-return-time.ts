import type {RentalOrder} from './types.ts';
import {DAY_MS} from './hourly-pricing.ts';
import {isCameraCategory, CAMERA_TIERS} from './camera-rental.ts';

/** The booked rental length follows the *actual physical pickup*.
 * Prepaid price and original appointment are kept in the order audit.
 * This is applied once, atomically, when the handover is confirmed.
 */
export function expectedReturnAfterHandover(
 order:Pick<RentalOrder,'pickupAt'|'scheduledPickupAt'|'returnAt'|'rentalDays'|'lines'|'rentalGroup'>,
 actualPickupAt:string
):string {
 const start=Date.parse(actualPickupAt);
 const bookedStart=Date.parse(order.scheduledPickupAt||order.pickupAt||'');
 const bookedEnd=Date.parse(order.returnAt||'');
 if(!Number.isFinite(start)||!Number.isFinite(bookedStart)||!Number.isFinite(bookedEnd)||bookedEnd<=bookedStart)
  throw new Error('Giờ thuê đã đặt không hợp lệ, cần kiểm tra lịch với Admin.');
 const camera=order.rentalGroup==='CAMERA'||order.lines.some(line=>isCameraCategory(line.category||''));
 let duration:number;
 if(camera){
  const hour=order.lines.find(line=>isCameraCategory(line.category||''))?.cameraPackageHours;
  if(!hour||!CAMERA_TIERS.includes(hour))throw new Error('Thiếu gói máy ảnh đã chốt, cần Admin kiểm tra.');
  duration=hour*3_600_000;
 }else{
  const days=typeof order.rentalDays==='number'&&Number.isInteger(order.rentalDays)&&order.rentalDays>=1?order.rentalDays:Math.ceil((bookedEnd-bookedStart)/DAY_MS);
  if(days<1||days>30)throw new Error('Số ngày thuê đã chốt không hợp lệ.');
  duration=days*DAY_MS;
 }
 return new Date(start+duration).toISOString();
}
