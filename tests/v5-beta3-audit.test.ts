import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvedLineQuote} from '../src/lib/v5-review-pricing.ts';
import {cameraPrice} from '../src/lib/camera-rental.ts';
import {billableBlocks,rentForBlocks,overlap} from '../src/lib/hourly-pricing.ts';
import {addCompletedRound} from '../src/lib/evidence-retention-rules.ts';
const route=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');
const ui=readFileSync('src/components/GuV5Review.tsx','utf8');
const types=readFileSync('src/lib/types.ts','utf8');

test('R50/M50 48h and overage always quote automatically based on original contract',()=>{
 const start='2026-10-18T01:00:00.000Z';
 const r50={category:'Máy ảnh',cameraModel:'Canon EOS R50' as const,cameraPackageHours:48 as const,cameraPackageBasePrice:350000,lineTotal:350000};
 const m50={category:'Máy ảnh',cameraModel:'Canon M50' as const,cameraPackageHours:48 as const,cameraPackageBasePrice:340000,lineTotal:340000};
 assert.deepEqual(approvedLineQuote(r50,start,'2026-10-20T01:00:00.000Z'),{amount:350000,pendingCameraLatePricing:false,cameraLateHours:0,cameraLateFee:0});
 assert.deepEqual(approvedLineQuote(r50,start,'2026-10-20T01:01:00.000Z'),{amount:360000,pendingCameraLatePricing:false,cameraLateHours:1,cameraLateFee:10000});
 assert.deepEqual(approvedLineQuote(m50,start,'2026-10-21T01:00:00.000Z'),{amount:580000,pendingCameraLatePricing:false,cameraLateHours:24,cameraLateFee:240000});
 assert.equal(cameraPrice('Canon EOS R50',3),110000);
 assert.equal(cameraPrice('Canon M50',24),180000);
});
test('Clothes/accessory exact 24h boundaries and 1/5/10/30 pricing preserved',()=>{
 const start='2026-10-18T02:00:00.000Z';
 assert.equal(billableBlocks(start,'2026-10-19T02:00:00.000Z'),1);
 assert.equal(billableBlocks(start,'2026-10-19T02:00:01.000Z'),2);
 assert.equal(rentForBlocks('CLOTHING',5),130000);
 assert.equal(rentForBlocks('ACCESSORY',5),70000);
 assert.equal(rentForBlocks('CLOTHING',30),580000);
 assert.equal(rentForBlocks('ACCESSORY',30),370000);
});
test('A later same-day reservation does not overlap interval ending at boundary',()=>{
 assert.equal(overlap('2026-10-18T02:00:00Z','2026-10-18T05:00:00Z','2026-10-18T05:00:00Z','2026-10-18T08:00:00Z'),false);
});
test('Admin only may cancel/void/review and settle legacy camera overtime automatically',()=>{
 assert.match(route,/\['VOID','CANCEL','APPROVE_RETURN','AUTO_RESOLVE_CAMERA_LATE'\]\.includes\(action\)\)requireAdmin\(me\)/);
 assert.match(ui, /isAdmin&&order\.status==='RESERVED'&&<button/);
 assert.match(route,/cameraLateFeePending\)throw new ApiError\(409/);
 assert.match(route,/action==='AUTO_RESOLVE_CAMERA_LATE'/);
});
test('staff can capture proofs within full order detail, Admin-only approval remains enforced',()=>{
 assert.match(route,/verifyProofUploads/);
 assert.match(route,/APPROVE_RETURN/);
 assert.match(route,/requireAdmin\(me\)/);
 const capture=readFileSync('src/components/GuOrderCapture.tsx','utf8');
 assert.match(capture,/phase==='RETURN'/);
});
test('Early handover atomically locks its extra interval and persists the actual start',()=>{
 assert.match(route,/const earlySlots=earlyHandover\?intervalRefs/);
 assert.match(route,/await checkIntervalAvailability\(tx,earlySlots,id\)/);
 assert.match(route,/createIntervalWrites\(tx,earlySlots,earlyPrior,id\)/);
 assert.match(route,/scheduledPickupAt:order\.pickupAt,pickupAt:now/);
});
test('Physical asset retention stays seven fully-approved rounds',()=>{
 let rounds: {orderId:string;completedAt:string}[]=[];
 for(let i=1;i<=8;i++)rounds=addCompletedRound(rounds,{orderId:'order'+i,completedAt:'2026-10-'+String(i).padStart(2,'0')+'T00:00:00Z'}).keep;
 assert.equal(rounds.length,7);
 assert.equal(rounds[0].orderId,'order2');
});
test('InventoryItem does not redeclare category as optional after mandatory property',()=>{
 const item=types.slice(types.indexOf('export interface InventoryItem'),types.indexOf('export interface Customer'));
 assert.equal((item.match(/category:/g)||[]).length,1);
 assert.equal((item.match(/category\?:/g)||[]).length,0);
});

test('Prior handover images cannot be replayed as supplementary product photos',()=>{
 assert.match(route,/const existingPhotoUrls=new Set/);
 assert.match(route,/Ảnh giao bổ sung không được dùng lại ảnh/);
});
test('Staff cannot cancel even legacy orders',()=>{
 const legacy=readFileSync('src/app/api/orders/[id]/route.ts','utf8');
 assert.match(legacy,/action==='CANCEL'&&me\.role!=='admin'/);
});
test('Failed photo deletion rotates cleanup queue and stale tasks cannot block it',()=>{
 const retention=readFileSync('src/lib/evidence-retention.ts','utf8');
 assert.match(retention,/Never delete one of the latest seven/);
 assert.match(retention,/tx\.delete\(jobRef\)/);
 assert.match(retention,/lastAttemptAt/);
});
test('Visual search result click opens a usable selected product preview',()=>{
 const finder=readFileSync('src/components/GuVisualFinder.tsx','utf8');
 assert.match(finder,/setChosen\(item\)/);
 assert.match(finder,/gu-v5-found-detail/);
});

test('Fully prepaid camera with unsettled overdue fee stays visible to Admin',async()=>{
 const {debtIndexKind,summaryFromDebtIndex,debtIndexRecord}=await import('../src/lib/debt-index.ts');
 const order={id:'ord1',code:'TH-1',customerId:'c1',customerName:'Mai',customerPhone:'0912345678',status:'RETURNED',pickupDate:'2026-10-18',returnDate:'2026-10-20',total:350000,paid:350000,createdAt:'2026-10-18T00:00:00Z',updatedAt:'2026-10-21T00:00:00Z',cameraLateFeePending:true} as Parameters<typeof debtIndexKind>[0];
 assert.equal(debtIndexKind(order),'open');
 const rows=[debtIndexRecord(order)];
 const result=summaryFromDebtIndex(rows);
 assert.equal(result.pendingCameraLateCount,1);
 assert.equal(result.accounts.length,1);
 assert.equal(result.totalOutstanding,0);
 assert.equal(result.accounts[0].orders[0].cameraLateFeePending,true);
});

test('Any returned garment/device with ISSUE requires a note and is quarantined',()=>{
 assert.match(route,/condition==='ISSUE'\)&&\(!p\.note/);
 assert.match(route,/const state=missing\?'MISSING':issue\?'MAINTENANCE'/);
});

test('Admin camera overtime is included once in total, not added as separate late fee',()=>{
 assert.match(route,/cameraOvertimeFeeTotal=quote\.reduce/);
 assert.match(route,/lateFeeTotal:0,rentalDays:actualBlocks/);
 assert.match(route,/\+\(order\.lateFeeTotal\|\|0\)-\(order\.paid\|\|0\)/);
});
