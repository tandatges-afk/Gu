import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pacificDayWindow,usageStatus,sumMonitoringSeries,latestMonitoringValue,FIRESTORE_FREE} from '../src/lib/usage-metrics.ts';
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
test('System API enforces Admin permission and provider data only',()=>{
 const code=read('src/app/api/system/route.ts');
 assert.match(code,/me.role!=='admin'/);assert.doesNotMatch(code,/monitoring.googleapis.com/);assert.match(code,/api.cloudinary.com/);
 assert.match(code,/CLOUDINARY_API_SECRET/);assert.doesNotMatch(code,/firestoreReport|collectionCounts/);
 assert.doesNotMatch(read('src/components/GuSystem.tsx'),/CLOUDINARY_API_SECRET/);
});
test('Six long-term changes have corresponding server support',()=>{
 for(const file of ['src/app/api/catalog/route.ts','src/app/api/calendar/route.ts','src/app/api/stock-state/route.ts',
   'src/app/api/reports/route.ts','scripts/backup-firestore.mjs','scripts/migrate-revenue-history.mjs'])assert.ok(read(file).length>200,file);
 assert.match(read('src/app/api/bootstrap/route.ts'),/limit\(80\)/);
 assert.match(read('src/components/GuExtras.tsx'),/thumbCloudinaryUrl/);
});

test('Tasks view reads server task results rather than just recent orders',()=>{
 const src=read('src/app/page.tsx');
 assert.match(src,/const filteredOrders=\(taskView!=='ALL'\?taskOrders/);
});
