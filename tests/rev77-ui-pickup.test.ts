import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pickupForDisplay,wasHandedOverEarly} from '../src/lib/order-pickup-presentation.ts';
const ts=(path:string)=>readFileSync(path,'utf8');
const scheduled='2026-10-29T05:39:00+07:00';
const earlier='2026-10-29T04:34:00+07:00';
const later='2026-10-29T06:12:00+07:00';
test('Rev7.7: actual handover displayed after early or late pickup, reservation stays planned',()=>{
 const pending={status:'RESERVED' as const,pickupAt:scheduled,scheduledPickupAt:scheduled,handoverProof:{status:'APPROVED' as const,items:[],at:earlier}};
 assert.equal(pickupForDisplay(pending),scheduled);
 const handed={...pending,status:'PICKED_UP' as const};
 assert.equal(pickupForDisplay(handed),earlier);
 assert.equal(wasHandedOverEarly(handed),true);
 assert.equal(pickupForDisplay({...handed,handoverProof:{...handed.handoverProof,at:later}}),later);
 assert.equal(wasHandedOverEarly({...handed,handoverProof:{...handed.handoverProof,at:later}}),false);
 assert.equal(pickupForDisplay({...handed,handoverProof:undefined}),scheduled);
 assert.equal(pickupForDisplay({...handed,handoverProof:{...handed.handoverProof,at:'invalid'}}),scheduled);
 assert.equal(pending.pickupAt,scheduled); // no mutation of scheduling/billing data
});
test('Rev7.7: order detail and calendar use the same physical pickup presentation',()=>{
 const page=ts('src/app/page.tsx');
 const detail=ts('src/components/GuV5Review.tsx');
 assert.match(page,/const pickup=vnDisplayHour\(pickupForDisplay\(order\)\)/);
 assert.match(page,/pickupForDisplay\(shown\)/);
 assert.match(page,/pickupForDisplay\(o\)/);
 assert.match(detail,/Khách đã nhận lúc/);
 assert.match(detail,/pickupForDisplay\(order\)/);
 assert.match(detail,/Xem giờ hẹn ban đầu và giờ tính tiền/);
});
test('Rev7.7: no stray zero in payment, settlement remains an explicit two-step flow',()=>{
 const pay=ts('src/components/GuOrderPaymentPanel.tsx');
 const capture=ts('src/components/GuOrderCapture.tsx');
 const css=ts('src/app/gu-redesign.css');
 assert.match(pay,/Boolean\(useSecurity&&order\.handoverCashCollateralAmount/);
 assert.match(capture,/Thu tiền còn thiếu/);
 assert.match(capture,/Hoàn cọc \/ trả CCCD/);
 assert.match(capture,/Còn việc cần xử lý/);
 assert.match(css,/\.login-box \.gu-password-field>\.input\{[^}]*margin:0!important/);
 assert.match(css,/\.gu-settlement-money/);
});
