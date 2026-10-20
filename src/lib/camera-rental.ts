/** Camera rates attach to the contracted package, not the cheapest package after a late return. */
export const CAMERA_MODELS=['Canon EOS R50','Canon M50'] as const;
export type CameraModel=typeof CAMERA_MODELS[number];
export function isCameraCategory(category:string):boolean {return /máy\s*ảnh|may\s*anh|camera/i.test(category);}
export function isCameraModel(model:unknown):model is CameraModel{return CAMERA_MODELS.includes(model as CameraModel);}
export const CAMERA_PRICE:Record<CameraModel,readonly [number,number,number,number]>={
 'Canon EOS R50':[110_000,130_000,190_000,350_000],
 'Canon M50':[90_000,110_000,180_000,340_000]
};
export const CAMERA_TIERS=[3,6,24,48] as const;
export type CameraPackageHours=typeof CAMERA_TIERS[number];
export const CAMERA_LATE_HOURLY_FEE=10_000;
const HOUR_MS=3_600_000;
export function cameraPackageForDuration(hours:number):CameraPackageHours {
 if(!Number.isFinite(hours)||hours<=0)throw new Error('Thời gian thuê máy ảnh không hợp lệ.');
 return CAMERA_TIERS.find(h=>hours<=h)??48;
}
export function cameraBasePrice(model:CameraModel,hours:CameraPackageHours):number {
 if(!isCameraModel(model))throw new Error('Mẫu máy ảnh không hợp lệ.');
 const idx=CAMERA_TIERS.indexOf(hours);
 if(idx<0)throw new Error('Gói thuê máy ảnh không hợp lệ.');
 return CAMERA_PRICE[model][idx];
}
export type CameraLine={category?:string;cameraModel?:CameraModel;cameraPackageHours?:CameraPackageHours;cameraPackageBasePrice?:number;lineTotal?:number};
/** Explicit tier chosen by staff. The scheduled return may be earlier, but never beyond the paid tier. */
export function chosenCameraPackageSnapshot(model:CameraModel,scheduledStart:string,scheduledEnd:string,chosen:unknown){
 if(typeof chosen!=='number'||!CAMERA_TIERS.includes(chosen as CameraPackageHours))throw new Error('Phải chọn gói máy ảnh 3h, 6h, 24h hoặc 48h.');
 const duration=(Date.parse(scheduledEnd)-Date.parse(scheduledStart))/HOUR_MS;
 if(!Number.isFinite(duration)||duration<=0)throw new Error('Khoảng giờ thuê máy ảnh không hợp lệ.');
 if(duration>chosen+1e-8)throw new Error('Giờ trả dự kiến vượt gói máy ảnh đã chọn. Hãy chọn gói dài hơn hoặc chỉnh giờ trả.');
 return {cameraPackageHours:chosen as CameraPackageHours,cameraPackageBasePrice:cameraBasePrice(model,chosen as CameraPackageHours)};
}

export function cameraPackageSnapshot(model:CameraModel,scheduledStart:string,scheduledEnd:string):{cameraPackageHours:CameraPackageHours;cameraPackageBasePrice:number}{
 const duration=(Date.parse(scheduledEnd)-Date.parse(scheduledStart))/HOUR_MS;
 const hours=cameraPackageForDuration(duration);
 return {cameraPackageHours:hours,cameraPackageBasePrice:cameraBasePrice(model,hours)};
}
function terms(line:CameraLine,actualHours:number):{hours:CameraPackageHours;base:number}{
 if(!isCameraModel(line.cameraModel))throw new Error('Máy ảnh chưa xác định mẫu để tính giá, hãy liên hệ Admin.');
 if(line.cameraPackageHours!==undefined){
  const base=typeof line.cameraPackageBasePrice==='number'?line.cameraPackageBasePrice:cameraBasePrice(line.cameraModel,line.cameraPackageHours);
  if(!Number.isSafeInteger(base)||base<0||!CAMERA_TIERS.includes(line.cameraPackageHours))throw new Error('Giá gói máy ảnh đã chốt không hợp lệ.');
  return {hours:line.cameraPackageHours,base};
 }
 // Old beta 3 lines had no package snapshot. Recover the package from its locked line price
 // so older 3h rentals are NOT silently upgraded to a 6h package after late return.
 if(Number.isSafeInteger(line.lineTotal)){
  const index=CAMERA_PRICE[line.cameraModel].findIndex(value=>value===line.lineTotal);
  if(index>=0)return {hours:CAMERA_TIERS[index],base:line.lineTotal!};
 }
 const hours=cameraPackageForDuration(actualHours);
 return {hours,base:cameraBasePrice(line.cameraModel,hours)};
}
export function cameraQuoteForLine(line:CameraLine,startedAt:string,endedAt:string):{amount:number;packageHours:CameraPackageHours;basePrice:number;lateHours:number;lateFee:number}{
 const start=Date.parse(startedAt),end=Date.parse(endedAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Giờ trả phải sau lúc giao thực tế.');
 const elapsed=end-start;
 const {hours,base}=terms(line,elapsed/HOUR_MS);
 // Exactly at the contracted deadline: 0 fee. Any commenced next hour: +10,000đ.
 const lateHours=Math.max(0,Math.ceil((elapsed-hours*HOUR_MS)/HOUR_MS));
 const lateFee=lateHours*CAMERA_LATE_HOURLY_FEE;
 if(!Number.isSafeInteger(lateFee)||!Number.isSafeInteger(base+lateFee))throw new Error('Tiền thuê máy ảnh vượt giới hạn tính toán.');
 return {amount:base+lateFee,packageHours:hours,basePrice:base,lateHours,lateFee};
}
/** For a NEW booking (no package snapshot), pick a package before calculating any planned overtime. */
export function cameraPrice(model:CameraModel,hours:number):number {
 if(!isCameraModel(model))throw new Error('Mẫu máy ảnh không hợp lệ.');
 const pkg=cameraPackageForDuration(hours);
 const base=cameraBasePrice(model,pkg);
 return base+Math.max(0,Math.ceil(hours-pkg))*CAMERA_LATE_HOURLY_FEE;
}
export function normalizedSerial(raw:unknown):string{
 if(typeof raw!=='string'||!raw.trim()||raw.trim().length>60||!/^[a-zA-Z0-9-]+$/.test(raw.trim()))throw new Error('Máy ảnh phải có số serial thân máy (chữ, số, dấu gạch ngang).');
 return raw.trim().toUpperCase();
}
export function rentalCharge(item:CameraLine,startISO:string,endISO:string):number{
 const duration=(Date.parse(endISO)-Date.parse(startISO))/HOUR_MS;
 if(!Number.isFinite(duration)||duration<=0)throw new Error('Khoảng giờ thuê không hợp lệ.');
 if(isCameraCategory(item.category||'')){
  if(!isCameraModel(item.cameraModel))throw new Error('Máy ảnh chưa xác định mẫu để tính giá, hãy liên hệ Admin.');
  return cameraQuoteForLine(item,startISO,endISO).amount;
 }
 return rentalChargeClothing(item.category||'',startISO,endISO);
}
import {billableBlocks,rentalKind,rentForBlocks} from './hourly-pricing.ts';
function rentalChargeClothing(category:string,a:string,b:string){return rentForBlocks(rentalKind(category),billableBlocks(a,b));}
