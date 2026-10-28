import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoverBillingStart} from '../src/lib/gu-v52-workflow.ts';
import {rentalCharge,chosenCameraPackageSnapshot} from '../src/lib/camera-rental.ts';
import {cameraLateAlert,cameraLiveQuote} from '../src/lib/camera-live-status.ts';
import type {RentalOrder} from '../src/lib/types.ts';

const at=(h:number,m=0)=>`2026-10-28T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
const scheduled=at(1); // 08:00 VN
const early=at(0); // 07:00 VN
const late=at(3); // 10:00 VN
const cameraReturn=at(4); // 11:00 VN
const clothingReturn='2026-10-29T01:00:00.000Z'; // next 08:00 VN

test('08:00 reserved handover at 10:00 bills from 08:00 for camera and clothing',()=>{
 for(const bookingKind of ['RESERVE','WALK_IN']){
  const start=handoverBillingStart({bookingKind,pickupAt:scheduled,actualHandoverAt:late});
  assert.equal(start,scheduled);
  assert.equal(rentalCharge({category:'Trang phục'},start,clothingReturn),50000);
  const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
  assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg},start,cameraReturn),110000);
 }
});
test('08:00 reserved handover at 07:00 bills from 07:00 for camera and clothing',()=>{
 for(const bookingKind of ['RESERVE','WALK_IN']){
  const start=handoverBillingStart({bookingKind,scheduledPickupAt:scheduled,pickupAt:scheduled,actualHandoverAt:early});
  assert.equal(start,early);
  assert.equal(rentalCharge({category:'Trang phục'},start,clothingReturn),60000); // 25h
  const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
  assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg},start,cameraReturn),120000); // 4h
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
 assert.match(handler,/const actualLines=order\.lines\.map\(l=>\(\{\.\.\.l,startAt:billingStart\}\)\)/);
 assert.match(handler,/const fallbackStart=order\.scheduledPickupAt\|\|order\.pickupAt\|\|order\.handoverProof\?\.at/);
 assert.match(handler,/l\.startAt\|\|fallbackStart/);
 assert.match(camera,/const startedAt=line\.startAt\|\|order\.scheduledPickupAt/);
 assert.match(intervals,/order\.lines\.map\(l=>l\.startAt\)/);
 assert.match(detail,/Bắt đầu tính tiền thuê/);
});
test('debt fallback puts trusted SQL id last, avoiding TS2783 duplicate id',()=>{
 const debts=readFileSync('src/app/api/debts/route.ts','utf8');
 assert.match(debts,/scan\.rows\.map\(r=>\(\{\.\.\.r\.data,id:r\.id\}\)\)/);
 assert.doesNotMatch(debts,/\{id:r\.id,\.\.\.r\.data\}/);
});

test('camera early handover triggers overtime warning at 10:01, not 11:01',()=>{
 const pkg=chosenCameraPackageSnapshot('Canon EOS R50',scheduled,cameraReturn,3);
 const order={id:'camera',status:'PICKED_UP',rentalGroup:'CAMERA',pickupAt:scheduled,scheduledPickupAt:scheduled,returnAt:cameraReturn,total:120000,paid:0,
  lines:[{itemId:'cam',category:'Máy ảnh',cameraModel:'Canon EOS R50',...pkg,startAt:early,lineTotal:120000}]} as RentalOrder;
 assert.equal(cameraLateAlert(order,at(3))?.lateMinutes,undefined); // 10:00, no overtime yet
 assert.equal(cameraLateAlert(order,at(3,1))?.lateMinutes,1); // 10:01
 assert.equal(cameraLiveQuote(order,at(3,1))?.total,120000);
});
