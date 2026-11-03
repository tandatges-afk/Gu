import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
test('reserved prepaid cancellation keeps collected money without second cash increment',()=>{
 const source=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(source,/action==='CANCEL'&&order\.paid>0&&order\.bookingKind!=='RESERVE'/);
 assert.match(source,/kind:'RESERVATION_FORFEITED'/);
 assert.match(source,/tiền thuê đã thu; không phát sinh hoàn tiền/);
 assert.doesNotMatch(source,/if\(order\.paid>0\)throw new ApiError\(409,'Đơn đã thu tiền: cần hoàn tiền\/đối soát trước khi xóa\.'/);
});
test('camera handover requires a photo and fixed 18m or CCCD for newly created orders',()=>{
 const source=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(source,/orderGroup\(order\)==='CAMERA'&&\(!depositProofId/);
 assert.match(source,/const cashCollateral=\(clothingPolicy\|\|cameraPolicy\)\&\&depositKind==='CASH'\?collateralRequired:0/);
 assert.match(source,/const cameraPolicy=orderGroup\(order\)==='CAMERA'&&order\.settlementPolicyVersion===CAMERA_SETTLEMENT_VERSION/);
});
test('laundry locks handover button and the API still enforces availability',()=>{
 const review=read('src/components/GuV5Review.tsx');
 const capture=read('src/components/GuOrderCapture.tsx');
 const api=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(review,/disabled=\{busy\|\|notClean\.length>0\}/);
 assert.match(capture,/waitingLaundry/);
 assert.match(api,/s\.data\(\)\?\.status!=='AVAILABLE'/);
});
test('capture settlement and order details are condensed without losing audit details',()=>{
 const cap=read('src/components/GuOrderCapture.tsx');
 const review=read('src/components/GuV5Review.tsx');
 assert.match(cap,/gu-settlement-money/);
 assert.match(cap,/gu-settlement-step/);
 assert.match(cap,/Quyết toán hai bước/);
 assert.match(cap,/evidenceChecked/);
 assert.match(review,/gu-quick-money/);
 assert.match(review,/Chi tiết thu \/ hoàn tiền/);
 assert.match(cap,/summary>Xem ảnh chứng từ/);
 assert.doesNotMatch(cap,/gu-settlement-roadmap/);
});


test('return settlement shows precisely two steps, verifies evidence before payment and preserves collateral confirmation',()=>{
 const cap=read('src/components/GuOrderCapture.tsx');
 const start=cap.indexOf('aria-label="Quyết toán hai bước"');
 assert.ok(start>0);
 const settlement=cap.slice(start);
 assert.equal((settlement.match(/className="gu-settlement-step gu-simple-step"/g)||[]).length,2);
 assert.match(settlement,/Bước 1 Kiểm tra chứng từ/);
 assert.match(settlement,/Bước 2 Xác nhận thanh toán/);
 assert.match(settlement,/checked=\{evidenceChecked\}/);
 assert.match(settlement,/remaining>0\?\(evidenceReady\?/);
 assert.match(settlement,/disabled=\{busy\|\|!evidenceReady/);
 assert.match(settlement,/onClick=\{\(\)=>void confirmCollateral\(\)\}/);
 assert.doesNotMatch(settlement,/gu-settlement-roadmap/);
 assert.doesNotMatch(settlement,/gu-settlement-guidance/);
});
