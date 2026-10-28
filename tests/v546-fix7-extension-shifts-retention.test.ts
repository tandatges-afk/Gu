import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rentForBlocks} from '../src/lib/hourly-pricing.ts';
import {finalRent} from '../src/lib/gu-v52-workflow.ts';
import {collateralReturnQuote} from '../src/lib/clothing-collateral.ts';
import {effectiveRegistrationPeriod,earlyWindow,upcomingRegistrationWeek,registrationPeriod} from '../src/lib/shift-schedule.ts';
import {cleanupAllowed,SENSITIVE_RETENTION_MS} from '../src/lib/sensitive-evidence-rules.ts';
import {KEEP_INSPECTION_ROUNDS,addCompletedRound} from '../src/lib/evidence-retention-rules.ts';
const read=(f:string)=>readFileSync(f,'utf8');
test('Trang phục 1 ngày 50k, 2 ngày 60k, chỉ còn 10k khi đã thu 50k',()=>{
 assert.equal(rentForBlocks('CLOTHING',1),50_000);
 assert.equal(rentForBlocks('CLOTHING',2),60_000);
 assert.equal(collateralReturnQuote({security:300_000,kind:'CASH',rent:60_000,extras:0,paidRent:50_000}).refund,290_000);
 assert.equal(collateralReturnQuote({security:300_000,kind:'CASH',rent:60_000,extras:0,paidRent:0}).refund,240_000);
 const start=Date.parse('2026-10-27T08:00:00.000Z');
 assert.equal(finalRent({bookedRent:60_000,quotedRent:50_000,prepaid:true,scheduledReturn:new Date(start+48*3600_000).toISOString(),actualReturn:new Date(start+24*3600_000).toISOString()}),60_000);
 const api=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(api,/wasExtended=orderGroup\(order\)==='CLOTHING'/);
 assert.match(api,/bookedRentTotal:total,paid:paidAfter/);
});
test('Admin early registration lasts exactly 8h, not editable before/after window',()=>{
 const now=new Date('2026-10-27T04:00:00Z');
 const week=upcomingRegistrationWeek(now),window=earlyWindow(now,week);
 assert.equal(week,'2026-11-02');
 assert.equal(Date.parse(window.closesAt)-Date.parse(window.opensAt),8*3600_000);
 assert.equal(registrationPeriod(now).isOpen,false);
 assert.equal(effectiveRegistrationPeriod(now,window).isOpen,true);
 assert.equal(effectiveRegistrationPeriod(new Date(now.getTime()+7*3600_000),window).isOpen,true);
 assert.equal(effectiveRegistrationPeriod(new Date(now.getTime()+8*3600_000),window).isOpen,false);
 const endpoint=read('src/app/api/shifts/route.ts');
 assert.match(endpoint,/action!=='OPEN_EARLY'/);assert.match(endpoint,/me.role!=='admin'/);
});
test('Only delete sensitive evidence after 5 days of completion and after collateral return',()=>{
 const end='2026-10-20T12:00:00.000Z',when=Date.parse(end);
 assert.equal(SENSITIVE_RETENTION_MS,5*86_400_000);
 const returned={status:'RETURNED',returnedAt:end,hadHandoverDeposit:true,collateralReturnedAt:'2026-10-20T12:30:00.000Z'};
 assert.equal(cleanupAllowed(returned,when+5*86_400_000-1),false);
 assert.equal(cleanupAllowed(returned,when+5*86_400_000),true);
 assert.equal(cleanupAllowed({...returned,collateralReturnedAt:undefined},when+6*86_400_000),false);
 assert.equal(cleanupAllowed({status:'RETURNED',returnedAt:end},when+5*86_400_000),true);
 assert.equal(cleanupAllowed({status:'PICKED_UP',returnedAt:end},when+99*86_400_000),false);
 assert.equal(cleanupAllowed({status:'RETURNED',returnedAt:'invalid'},when+99*86_400_000),false);
});
test('8th complete handover/return pair retains 7, queues first pair right on RECEIVE',()=>{
 const original=Array.from({length:7},(_,i)=>({orderId:'o'+(i+1),completedAt:`2026-10-${String(i+1).padStart(2,'0')}`}));
 const r=addCompletedRound(original,{orderId:'o8',completedAt:'2026-10-08'});
 assert.equal(KEEP_INSPECTION_ROUNDS,7);assert.equal(r.keep.length,7);
 assert.deepEqual(r.expired.map(x=>x.orderId),['o1']);
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 const receive=route.split("}else if(action==='RECEIVE'){")[1].split("}else if(action==='REVIEW_PHOTOS'){")[0];
 assert.match(receive,/addCompletedRound/);assert.match(receive,/inspectionCleanup/);
 assert.match(route,/\['RECEIVE','REVIEW_PHOTOS'/);
});
test('VPS disk usage is from node statfs and displayed only in admin system page',()=>{
 const endpoint=read('src/app/api/system/route.ts');
 assert.match(endpoint,/me.role!=='admin'/);assert.match(endpoint,/statfs\('\/'\)/);assert.match(endpoint,/vps:\{disk:diskUsage/);
 assert.match(read('src/components/GuSystem.tsx'),/Còn trống/);
 assert.match(read('deploy-vps/gu-v546-prod-cleanup.timer'),/OnCalendar=hourly/);
 assert.match(read('deploy-vps/gu-v546-prod-cleanup.service'),/Environment=PORT=3302/);
});
test('Confirming collateral return closes capture dialog immediately after server ACK',()=>{
 const source=read('src/components/GuOrderCapture.tsx');
 assert.match(source,/RETURN_COLLATERAL',confirmReturned:true\}\)\}\);onClose\(\)/);
});
