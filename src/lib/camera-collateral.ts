/** New camera bookings: 18m VND security per physical body, separate from rent. */
import {collateralReturnQuote} from './clothing-collateral.ts';
export const CAMERA_SETTLEMENT_VERSION='CAMERA_CASH_OR_ID_V2' as const;
export const CAMERA_CASH_COLLATERAL_PER_ITEM=18_000_000;
export function cameraCollateralForLines(lines:readonly {category?:string}[]):number{
 if(!lines.length)throw Error('Đơn máy ảnh không có sản phẩm.');
 const amount=lines.length*CAMERA_CASH_COLLATERAL_PER_ITEM;
 if(!Number.isSafeInteger(amount))throw Error('Số tiền cọc máy ảnh vượt giới hạn.');
 return amount;
}
/** Booked rental payments are in paidRent already. Only unpaid rent and extras are deducted. */
export function cameraCollateralQuote(input:{security:number;rent:number;extras:number;paidRent:number;kind:'CCCD'|'CASH'}){
 return collateralReturnQuote(input);
}
