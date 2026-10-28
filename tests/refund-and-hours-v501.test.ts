import test from 'node:test';import assert from 'node:assert/strict';
import {returnReconciliation} from '../src/lib/settlement-ledger.ts';
import {occupiedInRange,localSearchRange,queryDays} from '../src/lib/hourly-availability.ts';
import {productSearchBigrams,matchesProductSearch} from '../src/lib/product-search.ts';
test('refund equals exact overpayment and never double counts as cash income',()=>{
 assert.deepEqual(returnReconciliation({rent:50000,compensation:0,otherFee:0,netPaid:75000}),{due:50000,refund:25000,netPaidAfterRefund:50000,outstanding:0});
 assert.equal(returnReconciliation({rent:100000,compensation:50000,otherFee:0,netPaid:40000}).outstanding,110000);
 assert.throws(()=>returnReconciliation({rent:-1,compensation:0,otherFee:0,netPaid:0}));
});
test('hourly intervals may share same date without overlapping',()=>{
 const a=localSearchRange('2026-11-02','2026-11-02','09:00','09:00');
 assert.equal(queryDays(a.from,a.to).length,2);
 assert.equal(occupiedInRange(false,[{orderId:'old',start:'2026-11-02T02:00:00.000Z',end:'2026-11-02T06:00:00.000Z'}],'2026-11-02T06:00:00.000Z','2026-11-02T08:00:00.000Z'),false);
 assert.equal(occupiedInRange(false,[{orderId:'old',start:'2026-11-02T02:00:00.000Z',end:'2026-11-02T06:00:00.000Z'}],'2026-11-02T05:00:00.000Z','2026-11-02T08:00:00.000Z'),true);
});
test('single-letter accent-insensitive search after index backfill',()=>{
 assert.ok(productSearchBigrams('Áo dài xanh lá').includes('a'));
 assert.ok(productSearchBigrams('Áo dài xanh lá').includes('d'));
 assert.equal(matchesProductSearch('Áo dài xanh lá','dao'),false);
 assert.equal(matchesProductSearch('Áo dài xanh lá','xanh'),true);
});
