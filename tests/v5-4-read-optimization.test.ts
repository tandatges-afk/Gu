import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cached,estimatedReads,measureRoute,readMetrics} from '../src/lib/read-optimization.ts';
import {SHIFT_DEFS} from '../src/lib/shift-schedule.ts';
const read=(path:string)=>readFileSync(path,'utf8');
test('read cache deduplicates simultaneous same-key fetches',async()=>{
 let calls=0;
 const load=async()=>{calls++;return {data:'same'};};
 const [a,b,c]=await Promise.all([cached('v54-test-unique-cache',2000,load),cached('v54-test-unique-cache',2000,load),cached('v54-test-unique-cache',2000,load)]);
 assert.equal(calls,1);assert.equal(a,b);assert.equal(b,c);
});
test('read diagnostics track only explicitly recorded requests',async()=>{
 await measureRoute('test v5.4 endpoint',async()=>{
  estimatedReads(8,2);
  await cached('v54-test-metric',2000,async()=>1);
  await cached('v54-test-metric',2000,async()=>2);
  return {headers:new Headers()};
 });
 const meter=readMetrics().endpoints.find(x=>x.endpoint==='test v5.4 endpoint');
 assert.equal(meter?.calls,1);assert.equal(meter?.readsEstimate,8);assert.equal(meter?.queries,2);assert.equal(meter?.cacheHits,1);
});
test('server shift boundaries remain 8–13, 13–17, 17–22',()=>{
 assert.deepEqual(SHIFT_DEFS.map(s=>[s.start,s.end]),[['08:00','13:00'],['13:00','17:00'],['17:00','22:00']]);
});
test('all booking paths retain fresh transaction-only locks',()=>{
 const create=read('src/app/api/v5/orders/route.ts');const update=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(create,/runTransaction/);assert.match(create,/checkIntervalAvailability/);
 assert.match(update,/runTransaction/);assert.match(update,/checkIntervalAvailability/);
 assert.doesNotMatch(create,/read-optimization|interval-lookup/);
 assert.doesNotMatch(update,/read-optimization|interval-lookup/);
});
test('sparse read-only lock lookup and diagnostics are exposed in API',()=>{
 assert.match(read('src/lib/interval-lookup.ts'),/orderBy\(FieldPath\.documentId\(\)\)/);
 assert.match(read('src/app/api/calendar/route.ts'),/findDayLocks/);
 assert.match(read('src/app/api/smart-calendar/route.ts'),/findDayLocks/);
 assert.match(read('src/app/api/bootstrap/updates/route.ts'),/full:false/);
 assert.match(read('src/app/api/debts/route.ts'),/AggregateField\.sum/);
 assert.match(read('src/app/api/reports/route.ts'),/range\(mode\)/);
 assert.match(read('src/app/api/system/read-metrics/route.ts'),/requireAdmin/);
});
