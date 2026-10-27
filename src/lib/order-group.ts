import {isCameraCategory} from './camera-rental.ts';
export type RentalGroup='CAMERA'|'CLOTHING';
export type ExistingOrderGroup=RentalGroup|'LEGACY_MIXED';
export function productGroup(category:string):RentalGroup{return isCameraCategory(category)?'CAMERA':'CLOTHING';}
/** Historical mixed orders remain visible, but new orders may never mix groups. */
export function orderGroup(order:{rentalGroup?:string;lines:readonly {category?:string}[]}):ExistingOrderGroup{
 const types=new Set(order.lines.map(line=>productGroup(line.category||'')));
 if(types.size>1)return 'LEGACY_MIXED';
 if(types.size===1)return [...types][0];
 return order.rentalGroup==='CAMERA'?'CAMERA':'CLOTHING';
}
export function itemsBelongToGroup(categories:readonly string[],group:RentalGroup):boolean{
 return categories.length>0&&categories.every(category=>productGroup(category)===group);
}
export function validCameraHours(hours:unknown):hours is 3|6|24|48{return [3,6,24,48].includes(hours as number);}
