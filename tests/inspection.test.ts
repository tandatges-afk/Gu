import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInspection} from '../src/lib/inspection.ts';
const lines=[
  {itemId:'item12345678',sku:'GU-001',replacementValue:900000},
  {itemId:'item23456789',sku:'GU-002',replacementValue:500000},
];
test('không hoàn thành nếu còn mục chưa kiểm',()=>{
  assert.throws(()=>calculateInspection(lines,[{itemId:'item12345678',status:'OK'}]),/Checklist/);
});
test('không chấp nhận mục trùng hoặc không hợp lệ',()=>{
  assert.throws(()=>calculateInspection(lines,[{itemId:'item12345678',status:'OK'},{itemId:'item12345678',status:'OK'}]),/Checklist/);
  assert.throws(()=>calculateInspection(lines,[{itemId:'item12345678',status:'OK'},{itemId:'item23456789',status:'WRONG'}]),/Checklist/);
});
test('giá đền bù từ server, không lấy phí khách sửa ở browser',()=>{
  const result=calculateInspection(lines,[{itemId:'item12345678',status:'OK',compensation:1},{itemId:'item23456789',status:'MISSING',compensation:1}]);
  assert.equal(result[1].compensation,500000);
  assert.equal(result[0].compensation,0);
});
test('món chưa được Admin duyệt giá không thể báo thiếu rồi hoàn thành',()=>{
  assert.throws(()=>calculateInspection([{...lines[0],replacementValue:0}],[{itemId:'item12345678',status:'MISSING'}]),/Admin/);
});
test('đơn cũ thiếu snapshot dùng giá hiện tại do Admin duyệt',()=>{
  const result=calculateInspection([{...lines[0],replacementValue:0}],[{itemId:'item12345678',status:'MISSING'}],{item12345678:250000});
  assert.equal(result[0].compensation,250000);
});
