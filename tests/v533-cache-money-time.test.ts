import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatVNDateTime,formatVNDateKey,isoDayFromVN,isValidHHMM} from '../src/lib/vn-datetime.ts';
import {paymentReview} from '../src/lib/payment-review.ts';

test('24h VN timestamps use HH:MM DD/MM/YYYY including midnight',()=>{
 assert.equal(formatVNDateTime('2026-10-20T17:00:00.000Z'),'00:00 21/10/2026');
 assert.equal(formatVNDateTime('2026-10-20T05:09:00.000Z'),'12:09 20/10/2026');
 assert.equal(formatVNDateKey('2026-10-20'),'20/10/2026');
 assert.equal(isoDayFromVN('20/10/2026'),'2026-10-20');
 assert.equal(isoDayFromVN('31/02/2026'),null);
 assert.equal(isValidHHMM('23:59'),true);
 assert.equal(isValidHHMM('24:00'),false);
});
test('payment review does not fabricate a surcharge from an overpayment',()=>{
 assert.deepEqual(paymentReview({total:50000,paid:60000}),{rent:50000,extra:0,amountDue:50000,overpaid:10000});
 assert.deepEqual(paymentReview({total:50000,paid:60000,otherFeeTotal:10000}),{rent:50000,extra:10000,amountDue:60000,overpaid:0});
 assert.deepEqual(paymentReview({total:60000,paid:60000,cameraOvertimeFeeTotal:10000}),{rent:50000,extra:10000,amountDue:60000,overpaid:0});
});
test('catalog views use per-session cache and review cannot click laundry stat',()=>{
 const page=readFileSync('src/app/page.tsx','utf8');
 assert.match(page,/tabCacheRef=useRef/);
 assert.match(page,/saveCache\(key,result\)/);
 assert.doesNotMatch(page,/<button className="gu-status-link" onClick=\{\(\)=>setPage\('laundry'\)\}/);
});
test('V5 form stays actionable but validates server-required payment proof',()=>{
 const booking=readFileSync('src/components/GuV5Booking.tsx','utf8');
 assert.match(booking,/disabled=\{busy\}/);
 assert.match(booking,/reservationProofId/);
 assert.match(booking,/incomplete\)\{setError\(incomplete\);return;\}/);
});
