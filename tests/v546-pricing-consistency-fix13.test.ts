import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMERA_MODELS,CAMERA_TIERS,CAMERA_PRICE,cameraQuoteForLine,chosenCameraPackageSnapshot,rentalCharge} from '../src/lib/camera-rental.ts';
import {cameraLateAlert,cameraLiveQuote} from '../src/lib/camera-live-status.ts';
import {handoverBillingStart,finalRent} from '../src/lib/gu-v52-workflow.ts';
import {billableBlocks,rentalKind,rentForBlocks} from '../src/lib/hourly-pricing.ts';
import type {RentalOrder} from '../src/lib/types.ts';

const start='2026-10-28T04:47:00.000Z'; // 11:47 Viet Nam
const early='2026-10-28T04:43:00.000Z'; // 11:43 Viet Nam
const add=(stamp:string,minutes:number)=>new Date(Date.parse(stamp)+minutes*60000).toISOString();
const route=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');

test('handover persists billing START, never advances a monetary total for a scheduled hypothetical return',()=>{
 assert.match(route,/const actualLines=order\.lines\.map\(l=>\(\{\.\.\.l,startAt:billingStart,startDate:vnDayKey\(now\)\}\)\)/);
 assert.match(route,/const actualTotal=order\.total/);
 assert.doesNotMatch(route,/computedTotal=actualLines/);
 assert.match(route,/const nextTotal=order\.total/); // handover extra items also avoids future-fee precharging
});

test('Canon R50 11:47 booking with 11:43 handover is 110k when returned within three actual hours',()=>{
 const pkg=chosenCameraPackageSnapshot('Canon EOS R50',start,add(start,180),3);
 const billingStart=handoverBillingStart({pickupAt:start,actualHandoverAt:early});
 const line={category:'Máy ảnh',cameraModel:'Canon EOS R50' as const,...pkg,lineTotal:110000,startAt:billingStart};
 assert.equal(billingStart,early);
 assert.equal(cameraQuoteForLine(line,early,add(early,180)).amount,110000);
 assert.equal(cameraQuoteForLine(line,early,add(start,180)).amount,120000);
 const o={id:'r50',rentalGroup:'CAMERA',status:'PICKED_UP',pickupAt:start,returnAt:add(start,180),total:110000,paid:0,lines:[line]} as RentalOrder;
 assert.equal(cameraLateAlert(o,add(early,180)),null);
 assert.equal(cameraLiveQuote(o,add(early,181))?.total,120000);
});

for(const model of CAMERA_MODELS){
 for(const tier of CAMERA_TIERS){
  test(`no premature charge, ${model} ${tier}h, early and late pickup, real return`,()=>{
   const due=add(start,tier*60);
   const pkg=chosenCameraPackageSnapshot(model,start,due,tier);
   const base=CAMERA_PRICE[model][CAMERA_TIERS.indexOf(tier)];
   const line={category:'Máy ảnh',cameraModel:model,...pkg,lineTotal:base};
   const earlyBilling=handoverBillingStart({pickupAt:start,actualHandoverAt:early});
   const latePickup=add(start,60);
   assert.equal(earlyBilling,early);
   assert.equal(handoverBillingStart({pickupAt:start,actualHandoverAt:latePickup}),latePickup);
   assert.equal(cameraQuoteForLine(line,earlyBilling,add(early,tier*60)).amount,base);
   assert.equal(cameraQuoteForLine(line,earlyBilling,add(early,tier*60+1)).amount,base+10000);
   assert.equal(cameraQuoteForLine(line,earlyBilling,due).amount,base+10000);
   assert.equal(cameraQuoteForLine(line,start,due).amount,base);
  });
 }
}

for(const category of ['Trang phục','Phụ kiện']){
 for(const days of [1,2,3,5,6,30]){
  test(`${category}: day ${days} consistent booking, return and overtime`,()=>{
   const kind=rentalKind(category);
   const due=add(start,days*24*60);
   const base=rentForBlocks(kind,days);
   assert.equal(billableBlocks(start,due),days);
   assert.equal(rentalCharge({category},start,due),base);
   if(days<30){
    const overtime=rentForBlocks(kind,days+1);
    assert.equal(rentalCharge({category},start,add(due,1)),overtime);
    assert.equal(rentalCharge({category},early,due),overtime);
    assert.equal(rentalCharge({category},early,add(early,days*24*60)),base);
   }
  });
 }
}

test('prepaid reservation cannot be double-charged, but actual early pickup overtime must be charged',()=>{
 const due=add(start,180);
 assert.equal(finalRent({bookedRent:110000,quotedRent:110000,prepaid:true,scheduledReturn:due,actualReturn:add(early,180)}),110000);
 assert.equal(finalRent({bookedRent:110000,quotedRent:120000,prepaid:true,scheduledReturn:due,actualReturn:due}),120000);
 assert.equal(finalRent({bookedRent:110000,quotedRent:110000,prepaid:false,scheduledReturn:due,actualReturn:add(early,180)}),110000);
 assert.equal(finalRent({bookedRent:70000,quotedRent:60000,prepaid:true,scheduledReturn:add(start,3*24*60),actualReturn:add(start,2*24*60)}),70000);
});
