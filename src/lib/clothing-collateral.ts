/** Collateral is held property, not earned rental revenue. Applicable only to new clothing/accessory orders. */
import {rentalKind} from './hourly-pricing.ts';
export const CLOTHING_SETTLEMENT_VERSION='CLOTHING_CASH_OR_ID_V1' as const;
export type ClothingCollateralKind='CASH'|'CCCD';
export function collateralForLines(lines:readonly {category?:string}[]):number {
 if(!lines.length)throw Error('Đơn không có sản phẩm.');
 return lines.reduce((sum,line)=>sum+(rentalKind(line.category||'')==='ACCESSORY'?200_000:300_000),0);
}
export function collateralReturnQuote(input:{security:number;rent:number;extras:number;paidRent:number;kind:ClothingCollateralKind}){
 const v=[input.security,input.rent,input.extras,input.paidRent];
 if(v.some(n=>!Number.isSafeInteger(n)||n<0)||input.rent+input.extras>Number.MAX_SAFE_INTEGER)throw Error('Số tiền đối soát không hợp lệ.');
 const outstanding=Math.max(0,input.rent+input.extras-input.paidRent);
 const applied=input.kind==='CASH'?Math.min(outstanding,input.security):0;
 return {outstanding,applied,refund:input.kind==='CASH'?input.security-applied:0,collect:outstanding-applied,returnId:input.kind==='CCCD'};
}
export function handoverLabel(order:{status:string;handoverProof?:{byName?:string}|null;history?:readonly {action:string}[]}):string{
 if(order.handoverProof?.byName)return 'Đã giao · '+order.handoverProof.byName;
 if(order.status==='PICKED_UP'||order.status==='RETURNED'||order.history?.some(x=>x.action==='HANDOVER_PHOTOS'))return 'Đã giao · Thiếu tên nhân viên (đơn cũ)';
 return 'Chưa giao';
}
