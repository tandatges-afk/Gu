import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {rentForBlocks,billableBlocks,overlap,splitIntoVietnamDays,localDateTimeToISO} from '../src/lib/hourly-pricing.ts';
import {normalizedAngles} from '../src/lib/inspection-proof.ts';
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
test('single capture workflow supports handover and return; Admin keeps review approval',()=>{
 const capture=read('src/components/GuOrderCapture.tsx');const review=read('src/components/GuV5Review.tsx');
 assert.match(capture,/HANDOVER_EXTRA/);assert.match(capture,/RECEIVE/);assert.match(capture,/preparePhonePhoto/);
 assert.match(review,/order\.handoverProof/);assert.match(review,/order\.returnProof/);assert.match(review,/APPROVE_RETURN/);
});
test('actual mobile handover is the clock origin for final 24h settlement',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(route,/startAt:now,lineTotal:rentalCharge/);
 assert.match(route,/billableBlocks\(order\.handoverProof\?\.at\|\|order\.pickupAt,order\.returnProof\.at\)/);
 assert.match(route,/syncDebtIndex\(tx,db\(\),\{\.\.\.order,lines:actualLines,total:actualTotal,status:'PICKED_UP'/);
});
