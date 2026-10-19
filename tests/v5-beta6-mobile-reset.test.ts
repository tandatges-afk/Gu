import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');

test('mobile remains a 2-workflow client and shows new job notification',()=>{
 const page=read('src/app/mobile/page.tsx');
 assert.match(page,/type Tab='capture'\|'search'/);
 assert.match(page,/Giao \/ nhận/);
 assert.match(page,/Tìm bằng ảnh/);
 assert.match(page,/role="dialog"/);
 assert.doesNotMatch(page,/Tạo đơn thuê|Thanh toán đơn|Xóa đơn/);
});
test('mobile visual review has photo progress, comparisons, and return condition recording',()=>{
 const page=read('src/app/mobile/page.tsx');
 for(const s of ['gu-mobile-progress-track','gu-mobile-photo-pair','gu-mobile-camera-btn','gu-mobile-condition','gu-mobile-submit-zone','gu-mobile-item'])assert.ok(page.includes(s),s);
 assert.match(page,/canSubmit=.*required===completed/);
 assert.match(page,/missingNotes/);
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
 assert.match(read('public/gu-sw.js'),/gu-static-v5-0-beta10/);
});
