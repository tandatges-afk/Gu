import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {rentForBlocks,billableBlocks,overlap,splitIntoVietnamDays,localDateTimeToISO} from '../src/lib/hourly-pricing.ts';
import {normalizedAngles} from '../src/lib/inspection-proof.ts';
import {handoverBillingStart,finalRent} from '../src/lib/gu-v52-workflow.ts';
import {rentalCharge} from '../src/lib/camera-rental.ts';
const read=(f:string)=>readFileSync(f,'utf8');
test('tiered 24-hour price is cumulative for day 1, 5, 10, 30',()=>{
 for(const [kind,price] of [['CLOTHING',[50000,130000,220000,580000]],['ACCESSORY',[20000,70000,130000,370000]]] as const){
  assert.deepEqual([1,5,10,30].map(d=>rentForBlocks(kind,d)),price);
 }
});
test('hourly overlap allows same day with nonoverlapping slots',()=>{
 const a=localDateTimeToISO('2026-10-18T09:00'),b=localDateTimeToISO('2026-10-18T10:00'),c=localDateTimeToISO('2026-10-18T10:01');
 assert.equal(overlap(a,b,b,c),false);
 assert.equal(overlap(a,c,b,c),true);
 assert.equal(splitIntoVietnamDays(localDateTimeToISO('2026-10-18T23:00'),localDateTimeToISO('2026-10-19T01:00')).length,2);
 assert.equal(billableBlocks(a,b),1);
});
test('Admin can define 1..10 independent required photo angles',()=>{
 assert.deepEqual(normalizedAngles(['Cổ áo','Tay áo']),['Cổ áo','Tay áo']);
 assert.throws(()=>normalizedAngles(['Cổ áo','Cổ áo']));
 assert.throws(()=>normalizedAngles([]));
});
test('unified staff role accepts legacy mobile accounts without a separate site',()=>{
 const auth=read('src/lib/http.ts');const main=read('src/app/page.tsx');
 assert.match(auth,/role!=='staff_mobile'/);assert.match(auth,/role==='admin'\?'admin':'staff'/);
 assert.doesNotMatch(main,/window\.location\.href='\/mobile'/);
 assert.match(read('src/app/api/v5/orders/[id]/route.ts'),/verifyProofUploads/);
});
test('legacy and hourly locks checked together',()=>{
 const hourly=read('src/lib/v5-server.ts');const old=read('src/app/api/orders/[id]/route.ts');
 assert.match(hourly,/collection\('rentalSlots'\)/);
 assert.match(old,/v5DayIntervals/);
});
test('single capture workflow supports handover/return; Admin reviews after staff release',()=>{
 const capture=read('src/components/GuOrderCapture.tsx');const review=read('src/components/GuV5Review.tsx');
 assert.match(capture,/HANDOVER_EXTRA/);assert.match(capture,/RECEIVE/);assert.match(capture,/preparePhonePhoto/);
 assert.match(review,/order\.handoverProof/);assert.match(review,/order\.returnProof/);assert.match(review,/REVIEW_PHOTOS/);
});
test('late handover starts package at actual pickup, preserving original agreed price',()=>{
 const scheduled='2026-10-22T07:00:00.000Z'; // 14:00 in Vietnam
 const deadline='2026-10-23T07:00:00.000Z';
 const clothing={category:'Áo dài'};
 const bookedRent=rentalCharge(clothing,scheduled,deadline);
 for(const arrived of ['2026-10-22T08:00:00.000Z','2026-10-22T10:00:00.000Z']){
  const start=handoverBillingStart({bookingKind:'RESERVE',pickupAt:scheduled,actualHandoverAt:arrived});
  assert.equal(start,arrived);
  assert.equal(rentalCharge(clothing,start,new Date(Date.parse(arrived)+86400000).toISOString()),bookedRent);
  assert.equal(finalRent({bookedRent,quotedRent:bookedRent,prepaid:true,scheduledReturn:deadline,actualReturn:deadline}),bookedRent);
 }
 // A same-day scheduled pickup must also preserve its agreed time when late.
 assert.equal(handoverBillingStart({bookingKind:'WALK_IN',pickupAt:scheduled,actualHandoverAt:'2026-10-22T08:00:00.000Z'}),'2026-10-22T08:00:00.000Z');
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(route,/handoverBillingStart\(\{bookingKind:order\.bookingKind/);
 assert.match(route,/const actualLines=order\.lines\.map\(l=>\(\{\.\.\.l,startAt:billingStart,startDate:vnDayKey\(now\)\}\)\)/);
 assert.match(route,/handoverProof:\{status:'SUBMITTED',by:me\.uid,byName:me\.name,at:now/);
 assert.doesNotMatch(route,/syncDebtIndex/);
});
