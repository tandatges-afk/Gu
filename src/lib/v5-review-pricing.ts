/** Final quote uses the original contracted camera package and the REAL handover/return timestamps. */
import {cameraQuoteForLine,isCameraCategory,type CameraLine} from './camera-rental.ts';
import {actualReturnBlocks,rentalKind,rentForBlocks} from './hourly-pricing.ts';
export type QuoteLine=CameraLine;
export function approvedLineQuote(line:QuoteLine,startedAt:string,returnedAt:string):{amount:number;pendingCameraLatePricing:boolean;cameraLateHours:number;cameraLateFee:number}{
 const hours=(Date.parse(returnedAt)-Date.parse(startedAt))/3600000;
 if(!Number.isFinite(hours)||hours<=0)throw new Error('Giờ trả phải sau lúc giao thực tế.');
 if(isCameraCategory(line.category||'')){
  const quote=cameraQuoteForLine(line,startedAt,returnedAt);
  return {amount:quote.amount,pendingCameraLatePricing:false,cameraLateHours:quote.lateHours,cameraLateFee:quote.lateFee};
 }
 return {amount:rentForBlocks(rentalKind(line.category||''),actualReturnBlocks(startedAt,returnedAt)),pendingCameraLatePricing:false,cameraLateHours:0,cameraLateFee:0};
}
