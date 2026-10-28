import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReturnSettlement} from '../src/lib/return-settlement.ts';
import {readFileSync} from 'node:fs';
const root=new URL('../src/',import.meta.url);
const lines=[
  {itemId:'a',replacementValue:900000,dailyRate:300000},
  {itemId:'b',replacementValue:400000,dailyRate:100000},
];
const opts={lines,returnDate:'2026-10-15',actualDate:'2026-10-16',rentalTotal:800000,alreadyPaid:200000};
test('chưa kiểm đủ thì không cho đến bước thanh toán',()=>{
  const result=previewReturnSettlement({...opts,checks:{a:'OK'}});
  assert.equal(result.complete,false);assert.equal(result.verified,1);
});
test('sau khi kiểm đủ, phí trễ tự tính 1 ngày theo giá chốt + số tiền còn nợ',()=>{
  const result=previewReturnSettlement({...opts,checks:{a:'OK',b:'OK'}});
  assert.equal(result.complete,true);
  assert.equal(result.days,1);assert.equal(result.lateFee,400000);
  assert.equal(result.compensation,0);
  assert.equal(result.remaining,1000000);
});
test('đồ thiếu cộng đền bù tự động, phí khác chỉ cộng khi nhập',()=>{
  const result=previewReturnSettlement({...opts,checks:{a:'MISSING',b:'OK'},otherFee:50000});
  assert.equal(result.compensation,900000);assert.equal(result.otherFee,50000);
  assert.equal(result.remaining,1950000);
});
test('đồ thiếu chưa có giá đền bù không được chốt',()=>{
  const result=previewReturnSettlement({...opts,lines:[{itemId:'c',replacementValue:0,dailyRate:100000}],checks:{c:'MISSING'}});
  assert.deepEqual(result.unresolved,['c']);
});
test('máy chủ tự tính phí trễ và tính số còn thu trong giao dịch',()=>{
  const api=readFileSync(new URL('app/api/orders/[id]/route.ts',root),'utf8');
  assert.match(api,/const specifiedLate=lateBase/);
  assert.match(api,/collectRemainingAtReturn===true/);
  assert.match(api,/Math\.max\(0,maxCollection\)/);
  assert.match(api,/Phí trả trễ được hệ thống tự tính/);
});
test('giao diện yêu cầu checklist trước tiền, không nhập lại phí trễ',()=>{
  const ui=readFileSync(new URL('components/GuReturnFlow.tsx',root),'utf8');
  assert.match(ui,/stage==='check'/);
  assert.match(ui,/Tiếp tục · Xem tiền/);
  assert.doesNotMatch(ui,/setLateCharge|Phí trả trễ chốt thu/);
  assert.match(ui,/Thêm phụ phí khác/);
});
