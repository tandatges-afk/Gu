import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requiresFullPrepayment,finalRent,amountRemaining,vnClock} from '../src/lib/gu-v52-workflow.ts';
const read=(p:string)=>readFileSync(p,'utf8');
test('Future reservations require 100% prepaid regardless of button chosen',()=>{
 assert.equal(requiresFullPrepayment('2026-10-22T02:00:00Z','2026-10-19T14:00:00Z'),true);
 assert.equal(requiresFullPrepayment('2026-10-19T15:00:00Z','2026-10-19T10:00:00Z'),false);
 assert.equal(requiresFullPrepayment('2026-10-19T15:00:00Z','2026-10-19T10:00:00Z',true),true);
});
test('No extra rent after prepay when returned on time, even if pickup shifts',()=>{
 const scheduled='2026-10-22T10:00:00Z';
 assert.equal(finalRent({bookedRent:130000,quotedRent:60000,prepaid:true,scheduledReturn:scheduled,actualReturn:'2026-10-22T09:59:59Z'}),130000);
 assert.equal(finalRent({bookedRent:130000,quotedRent:170000,prepaid:true,scheduledReturn:scheduled,actualReturn:'2026-10-22T10:01:00Z'}),170000);
 assert.equal(finalRent({bookedRent:130000,quotedRent:70000,prepaid:false,scheduledReturn:scheduled,actualReturn:'2026-10-22T09:00:00Z'}),70000);
 assert.equal(amountRemaining(130000,130000),0);
 assert.equal(amountRemaining(130000,130000,15000),15000);
});
test('Phone hint positioned as dropdown, never in document flow',()=>{
 const css=read('src/app/globals.css');const form=read('src/components/GuV5Booking.tsx');
 assert.match(css,/\.gu-v11-customer-results\{position:absolute/);
 assert.match(form,/gu-customer-search-anchor/);
 assert.match(form,/setShowPhoneSuggestions\(false\)/);
 assert.doesNotMatch(form,/setCustomerId\(exact\.id\)/);
});
test('Server verifies proof and prepaid payment atomically during reservation creation',()=>{
 const route=read('src/app/api/v5/orders/route.ts');
 assert.match(route,/prepay&&!paymentProofId/);
 assert.match(route,/readVerifiedEvidence\(tx,paymentProofId/);
 assert.match(route,/tx\.update\(paymentEvidence\.ref,\{consumedOrderId:orderRef\.id/);
 assert.match(route,/kind:'PAYMENT',amount:total/);
});
test('Rental return releases inventory now; photo review later does not mutate items',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 const receive=route.split("}else if(action==='RECEIVE'){")[1].split("}else if(action==='REVIEW_PHOTOS'){")[0];
 const review=route.split("}else if(action==='REVIEW_PHOTOS'){")[1].split("}else if(action==='REFUND_RESERVATION'){")[0];
 assert.match(receive,/status:'RETURNED'/);
 assert.match(receive,/removeOrderIntervals\(tx,order\)/);
 assert.match(receive,/itemRefs\.forEach/);
 assert.match(receive,/stage:'REVIEW'/);
 assert.doesNotMatch(review,/tx\.update\(r,/);
 assert.match(review,/photoReviewStatus:'REVIEWED'/);
});
test('Payment popup remains after return and offers auto-collection',()=>{
 const capture=read('src/components/GuOrderCapture.tsx');
 assert.match(capture,/if\(phase==='RETURN'\)\{setSettling\(true\)/);
 assert.match(capture,/Thu đủ \{money\(due\)\}/);
 assert.match(capture,/APPLY_SURCHARGE/);
 assert.match(capture,/GuSecurePhoto id=\{order\.handoverDepositProofId\}/);
});
test('Sensitive collateral images only use private bucket, authenticated GET',()=>{
 const route=read('src/app/api/v5/secure-photo/route.ts');
 assert.match(route,/await staffUser\(req\)/);
 assert.match(route,/evidenceBucket\(\)\.file\(path\)\.save/);
 assert.match(route,/Cache-Control':'private,no-store/);
 assert.doesNotMatch(route,/res\.cloudinary/);
});
test('Calendar includes pickup/return times between guest and staff',()=>{
 const page=read('src/app/page.tsx');
 const posName=page.indexOf('gu-calendar-cell-result');const posTime=page.indexOf('gu-calendar-cell-time',posName);const posStaff=page.indexOf('gu-calendar-cell-creator',posName);
 assert.ok(posTime>posName&&posStaff>posTime);
 assert.equal(vnClock('2026-10-19T03:30:00Z'),'10:30');
});
