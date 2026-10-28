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
 assert.match(cap,/Còn việc cần xử lý/);
 assert.match(review,/gu-quick-money/);
 assert.match(review,/Chi tiết thu \/ hoàn tiền/);
 assert.match(cap,/summary>Kiểm tra ảnh cọc \/ CCCD đã giữ/);
});
