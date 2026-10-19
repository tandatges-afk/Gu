import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pacificDayWindow,usageStatus,sumMonitoringSeries,latestMonitoringValue,FIRESTORE_FREE} from '../src/lib/usage-metrics.ts';
import {debtIndexKind,debtIndexRecord,summaryFromDebtIndex} from '../src/lib/debt-index.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const read=(f:string)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('Firestore Pacific reset UTC follows DST in March',()=>{
  const before=pacificDayWindow(new Date('2026-03-08T08:45:00Z'));
  assert.equal(before.start,'2026-03-08T08:00:00.000Z');
  assert.equal(before.resetsAt,'2026-03-09T07:00:00.000Z');
});
test('Firestore resets around Pacific midnight, not Vietnam midnight',()=>{
  const w=pacificDayWindow(new Date('2026-10-16T05:00:00Z'));
  assert.equal(w.resetsAt,'2026-10-16T07:00:00.000Z');
  assert.equal(FIRESTORE_FREE.reads,50000);assert.equal(FIRESTORE_FREE.writes,20000);
});
test('Unknown metrics never masquerade as zero; threshold checks',()=>{
  assert.equal(sumMonitoringSeries({} as object),null);
  assert.equal(sumMonitoringSeries({timeSeries:[]}),null); // Missing provider series is not confirmed zero.
  assert.equal(latestMonitoringValue({timeSeries:[]}),null);
  assert.equal(usageStatus(null,50000),'unknown');
  assert.equal(usageStatus(10000,50000),'ok');
  assert.equal(usageStatus(38000,50000),'warning');
  assert.equal(usageStatus(45500,50000),'critical');
  assert.equal(sumMonitoringSeries({timeSeries:[{points:[{value:{int64Value:'3'}},{value:{int64Value:'7'}}]}]}),10);
});
const mk=(v:Partial<RentalOrder>):RentalOrder=>({id:'i1234567890',code:'TH-001',customerId:'c1',customerName:'Mai',customerPhone:'0900000000',
 pickupDate:'2026-10-10',returnDate:'2026-10-15',rentalDays:6,lines:[],total:500000,paid:100000,depositDue:0,
 note:'',status:'PICKED_UP',createdAt:'2026-10-01',updatedAt:'2026-10-01',createdBy:'admin',history:[],...v});
test('Debt ledger stores only uncollected orders and excludes canceled/paid',()=>{
 assert.equal(debtIndexKind(mk({status:'RETURNED',paid:500000})),null);
 assert.equal(debtIndexKind(mk({status:'CANCELLED'})),null);
 assert.equal(debtIndexKind(mk({status:'RESERVED'})),'reserved');
 assert.equal(debtIndexKind(mk({status:'PICKED_UP'})),'open');
 const rows=[debtIndexRecord(mk({id:'a1234567890'})),debtIndexRecord(mk({id:'b1234567890',status:'RETURNED',lateFeeTotal:50000})),debtIndexRecord(mk({id:'c1234567890',status:'RESERVED'}))];
 const result=summaryFromDebtIndex(rows);
 assert.equal(result.accounts.length,1);assert.equal(result.totalOutstanding,850000);
 assert.equal(result.reservationUnpaid,400000);
});
test('System API enforces Admin permission and provider data only',()=>{
 const code=read('src/app/api/system/route.ts');
 assert.match(code,/me.role!=='admin'/);assert.doesNotMatch(code,/monitoring.googleapis.com/);assert.match(code,/api.cloudinary.com/);
 assert.match(code,/CLOUDINARY_API_SECRET/);assert.doesNotMatch(code,/firestoreReport|collectionCounts/);
 assert.doesNotMatch(read('src/components/GuSystem.tsx'),/CLOUDINARY_API_SECRET/);
});
test('Six long-term changes have corresponding server support',()=>{
 for(const file of ['src/app/api/catalog/route.ts','src/app/api/calendar/route.ts','src/app/api/stock-state/route.ts',
   'src/app/api/reports/route.ts','src/lib/debt-index.ts','scripts/backup-firestore.mjs','scripts/migrate-revenue-history.mjs'])assert.ok(read(file).length>200,file);
 assert.match(read('src/app/api/bootstrap/route.ts'),/limit\(80\)/);
 assert.match(read('src/components/GuExtras.tsx'),/thumbCloudinaryUrl/);
});

test('Debt backfill protects concurrent payments and checkpoints after transactions',()=>{
 const src=read('scripts/migrate-debt-index.mjs');
 assert.match(src,/db\.runTransaction\(async tx/);
 assert.match(src,/tx\.get\(orderRef\)/);
 assert.match(src,/tx\.get\(ledgerRef\)/);
 assert.match(src,/tx\.delete\(ledgerRef\)/);
 assert.doesNotMatch(src,/bulkWriter/);
});
test('Tasks view reads server task results rather than just recent orders',()=>{
 const src=read('src/app/page.tsx');
 assert.match(src,/const filteredOrders=\(taskView!=='ALL'\?taskOrders/);
});
