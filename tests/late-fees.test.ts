import test from 'node:test';
import assert from 'node:assert/strict';
import {lateDays,lateBaseCharge,daysInclusive,addDays} from '../src/lib/rental.ts';

test('trả đúng hẹn và sớm không tính phí trả trễ',()=>{
  assert.equal(lateDays('2026-10-15','2026-10-15'),0);
  assert.equal(lateDays('2026-10-15','2026-10-14'),0);
});
test('trễ một ngày cộng một ngày thuê cho mỗi món theo đơn giá đã chốt',()=>{
  assert.equal(lateDays('2026-10-15','2026-10-16'),1);
  assert.equal(lateBaseCharge([{dailyRate:300000},{dailyRate:100000}],'2026-10-15','2026-10-16'),400000);
});
test('trễ 3 ngày tính đầy đủ kể cả qua tháng, không sửa ngày đã đặt',()=>{
  assert.equal(lateDays('2026-10-31','2026-11-03'),3);
  assert.equal(lateBaseCharge([{dailyRate:300000}],'2026-10-31','2026-11-03'),900000);
});
test('lịch cuộn một ngày giữ 7 ô liên tiếp và hiển thị cùng ngày khi thuê một ngày',()=>{
  assert.equal(daysInclusive('2026-10-15','2026-10-15'),1);
  const start='2026-10-15';const shifted=addDays(start,-1);
  assert.equal(shifted,'2026-10-14');
  assert.equal(addDays(shifted,6),'2026-10-20');
});
