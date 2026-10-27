import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {daysInclusive,occupiedDays,addDays,slotId,parseDate} from '../src/lib/rental.ts';
test('tính bao gồm ngày lấy lẫn ngày trả',()=>{
  assert.equal(daysInclusive('2027-02-10','2027-02-12'),3);
  assert.equal(daysInclusive('2028-02-28','2028-02-29'),2);
});
test('cùng mã đồ và ngày tạo ra cùng khóa',()=>{
  const id='ITEM123456789';
  assert.equal(slotId(id,'2027-02-10'),slotId(id,'2027-02-10'));
  assert.notEqual(slotId(id,'2027-02-10'),slotId(id,'2027-02-11'));
});
test('khóa luôn cả ngày đệm giặt',()=>{
  assert.deepEqual(occupiedDays('2027-02-10','2027-02-11',1),['2027-02-10','2027-02-11','2027-02-12']);
});
test('kiểm tra ngày hợp lệ và giới hạn 30 ngày',()=>{
  assert.throws(()=>parseDate('2027-02-29'));
  assert.throws(()=>daysInclusive('2027-03-05','2027-03-01'));
  assert.throws(()=>daysInclusive('2027-03-01','2027-04-01'));
  assert.equal(addDays('2028-02-28',1),'2028-02-29');
});
