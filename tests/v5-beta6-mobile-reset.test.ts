import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');

test('no separate /mobile page and capture is available inside unified order workspace',()=>{
 assert.ok(!existsSync('src/app/mobile/page.tsx'));
 const capture=read('src/components/GuOrderCapture.tsx');const main=read('src/app/page.tsx');
 assert.match(main,/GuOrderCapture/);assert.match(capture,/Chụp \/ Chọn ảnh/);
 assert.match(capture,/gu-capture-progress/);assert.match(capture,/gu-capture-conditions/);
});
test('destructive reset is explicitly opt-in, guarded by backup, project name and preserved staff',()=>{
 const script=read('scripts/reset-demo-data.mjs');
 assert.match(script,/PRESERVED = new Set\(\['staff'\]\)/);
 assert.match(script,/--backup-dir/);assert.match(script,/--confirm/);assert.match(script,/RESET-.*projectId/);
 assert.match(script,/m\.schema!=='GU-DEMO-BACKUP-v1'/);
 assert.match(script,/await db\.recursiveDelete/);
 assert.match(script,/const unknown=current\.filter/);
 assert.doesNotMatch(script,/deleteUsers\(/);
});
test('reset covers all operational data (not only customers/orders/items)',()=>{
 const script=read('scripts/reset-demo-data.mjs');
 for(const collection of ['rentalSlots','v5DayIntervals','mobileJobs','proofUploads','inspectionCleanup','inspectionEvidence','debtLedger','cashDaily','cameraSerialIndex','skuIndex','inventoryCounters','auditLogs']) assert.match(script,new RegExp("'"+collection+"'"));
});
test('PWA public asset cache is bumped for refreshed mobile UI',()=>{
 assert.match(read('public/gu-sw.js'),/gu-static-v5-0-beta11/);
});
