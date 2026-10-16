import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHangerCode, nextHangerSequence, getHangerCode } from '../src/lib/hanger-code.ts';
test('sequence bắt đầu GU-00001, tăng không trùng dù sản phẩm cùng tên, size, màu',()=>{
  assert.equal(formatHangerCode(nextHangerSequence(undefined)),'GU-00001');
  assert.equal(formatHangerCode(nextHangerSequence(1)),'GU-00002');
  assert.equal(formatHangerCode(99999),'GU-99999');
});
test('không dùng lại mã khi counter sai, tràn hoặc âm',()=>{
  for(const invalid of [-1,2.5,'2',99999,100000,NaN]) assert.throws(()=>nextHangerSequence(invalid));
  for(const invalid of [0,-1,100000,NaN,2.5]) assert.throws(()=>formatHangerCode(invalid));
});
test('mã móc cũ có thể chưa được gán nhưng id sản phẩm không đổi',()=>{
  assert.equal(getHangerCode({}),null);
  assert.equal(getHangerCode({hangerCode:'GU-00043'}),'GU-00043');
  assert.equal(getHangerCode({hangerCode:'khong-hop-le'}),null);
});
