import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoverBillingStart,noShowExpired} from '../src/lib/gu-v52-workflow.ts';
import {approvedLineQuote} from '../src/lib/v5-review-pricing.ts';
import {rentalCharge,chosenCameraPackageSnapshot} from '../src/lib/camera-rental.ts';
import {cameraLateAlert,cameraLiveQuote} from '../src/lib/camera-live-status.ts';
import type {RentalOrder} from '../src/lib/types.ts';

const at=(h:number,m=0)=>`2026-10-28T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
const scheduled=at(1); // 08:00 VN
const early=at(0); // 07:00 VN
const late=at(3); // 10:00 VN
const cameraReturn=at(4); // 11:00 VN
const clothingReturn='2026-10-29T01:00:00.000Z'; // next 08:00 VN

test('08:00 reserved handover at 10:00 preserves agreed 08:00 billing start',()=>{
 for(const bookingKind of ['RESERVE','WALK_IN']){
  const start=handoverBillingStart({bookingKind,pickupAt:scheduled,actualHandoverAt:late});
  assert.equal(start,scheduled);
  assert.equal(rentalCharge({category:'Trang phục'},start,new Date(Date.parse(start)+86400000).toISOString()),50000);
  const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
  assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg},start,new Date(Date.parse(start)+3*3600000).toISOString()),110000);
 }
});
test('08:00 reserved handover at 07:00 bills from 07:00 for camera and clothing',()=>{
 for(const bookingKind of ['RESERVE','WALK_IN']){
  const start=handoverBillingStart({bookingKind,scheduledPickupAt:scheduled,pickupAt:scheduled,actualHandoverAt:early});
  assert.equal(start,early);
  assert.equal(rentalCharge({category:'Trang phục'},start,new Date(Date.parse(early)+86400000).toISOString()),50000);
  const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
  assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg},start,new Date(Date.parse(early)+3*3600000).toISOString()),110000);
 }
});
test('scheduledPickupAt is preserved before actual pickup and Walk-in without schedule uses actual time',()=>{
 assert.equal(handoverBillingStart({bookingKind:'RESERVE',scheduledPickupAt:scheduled,pickupAt:at(2),actualHandoverAt:late}),scheduled);
 assert.equal(handoverBillingStart({bookingKind:'WALK_IN',actualHandoverAt:late}),late);
});
test('handover, camera live estimate, receive and interval cleanup reuse billing start',()=>{
 const handler=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');
 const camera=readFileSync('src/lib/camera-live-status.ts','utf8');
 const intervals=readFileSync('src/lib/v5-server.ts','utf8');
 const detail=readFileSync('src/components/GuV5Review.tsx','utf8');
 assert.match(handler,/const actualLines=order\.lines\.map\(l=>\(\{\.\.\.l,startAt:billingStart,startDate:vnDayKey\(billingStart\)\}\)\)/);
 assert.match(handler,/const fallbackStart=order\.scheduledPickupAt\|\|order\.pickupAt\|\|order\.handoverProof\?\.at/);
 assert.match(handler,/l\.startAt\|\|fallbackStart/);
 assert.match(camera,/const startedAt=line\.startAt\|\|order\.scheduledPickupAt/);
 assert.match(intervals,/order\.lines\.map\(l=>l\.startAt\)/);
 assert.match(detail,/Bắt đầu tính tiền thuê/);
});
test('camera early handover triggers overtime warning at 10:01, not 11:01',()=>{
 const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
 const order={id:'camera',status:'PICKED_UP',rentalGroup:'CAMERA',pickupAt:scheduled,scheduledPickupAt:scheduled,returnAt:cameraReturn,total:120000,paid:0,
  lines:[{itemId:'cam',category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg,startAt:early,lineTotal:120000}]} as RentalOrder;
 assert.equal(cameraLateAlert(order,at(3))?.lateMinutes,undefined); // 10:00, no overtime yet
 assert.equal(cameraLateAlert(order,at(3,1))?.lateMinutes,1); // 10:01
 assert.equal(cameraLiveQuote(order,at(3,1))?.total,120000);
});

test('new GU billing: booked 10:00, actual 10:20 still due tomorrow 10:00',()=>{
 const booked='2026-11-03T03:00:00.000Z';
 const actual='2026-11-03T03:20:00.000Z';
 const start=handoverBillingStart({pickupAt:booked,actualHandoverAt:actual});
 assert.equal(start,booked);
});
test('new GU billing: booked 10:00, actual 09:00 starts earlier',()=>{
 const booked='2026-11-03T03:00:00.000Z';
 const actual='2026-11-03T02:00:00.000Z';
 assert.equal(handoverBillingStart({pickupAt:booked,actualHandoverAt:actual}),actual);
});
test('only first 24h boundary has 10 minutes grace; 48h+5min costs third block',()=>{
 const started='2026-11-03T03:00:00.000Z';
 const plus=(m:number)=>new Date(Date.parse(started)+m*60_000).toISOString();
 const quote=(m:number)=>approvedLineQuote({category:'Trang phục'},started,plus(m)).amount;
 assert.equal(quote(24*60),50_000);
 assert.equal(quote(24*60+6),50_000);
 assert.equal(quote(24*60+10),50_000);
 assert.equal(quote(24*60+11),60_000);
 assert.equal(quote(48*60+5),70_000);
});
test('no-show is determined by the chosen 24h/48h package, never blanket 24h',()=>{
 const begin='2026-11-03T03:00:00.000Z';
 const plus=(h:number)=>new Date(Date.parse(begin)+h*3600_000).toISOString();
 const state={status:'RESERVED',pricingVersion:'GU_HOURLY_V1',pickupAt:begin,returnAt:plus(48)};
 assert.equal(noShowExpired(state,Date.parse(plus(24))),false);
 assert.equal(noShowExpired(state,Date.parse(plus(48))-1),false);
 assert.equal(noShowExpired(state,Date.parse(plus(48))),true);
 assert.equal(noShowExpired({...state,status:'PICKED_UP'},Date.parse(plus(48))),false);
});

test('48h camera no-show lasts the full paid tier even when calendar return label is earlier',()=>{
 const booked='2026-11-03T03:00:00.000Z';
 const later=(h:number)=>new Date(Date.parse(booked)+h*3600000).toISOString();
 const candidate={status:'RESERVED',pricingVersion:'GU_HOURLY_V1',rentalGroup:'CAMERA',pickupAt:booked,returnAt:later(24),lines:[{cameraPackageHours:48}]};
 assert.equal(noShowExpired(candidate,Date.parse(later(24))),false);
 assert.equal(noShowExpired(candidate,Date.parse(later(48))),true);
});
