import test from 'node:test';
import assert from 'node:assert/strict';
import {formatVndInput,vndDigits,vndCaretPosition} from '../src/lib/vnd-input.ts';
import {readFileSync} from 'node:fs';

test('1.000 / 10.000 / 100.000 / 1.000.000 format from whole VND without changing numbers',()=>{
  for(const [raw,display] of [['1000','1.000'],['10000','10.000'],['100000','100.000'],['1000000','1.000.000'],['0','0'],['','']]){
    assert.equal(formatVndInput(raw),display);
    assert.equal(vndDigits(display),raw);
  }
});
test('typing, pasting or deleting thousands separators never changes submitted VND',()=>{
  assert.equal(vndDigits('1.000.000'), '1000000');
  assert.equal(vndDigits('1 000 000 đ'), '1000000');
  assert.equal(vndDigits('0001000'), '1000');
  assert.equal(vndDigits(''), '');
  assert.equal(vndDigits('12.345,67'), '1234567'); // Whole VND only
});
test('caret preserves logical position while adding separators',()=>{
  assert.equal(vndCaretPosition('1.000',1),1);
  assert.equal(vndCaretPosition('1.000',2),3);
  assert.equal(vndCaretPosition('1.000.000',7),9);
});
test('all GU monetary entry points use reusable formatter',()=>{
  const root='src/';
  for(const file of ['app/page.tsx','components/GuReturnFlow.tsx','components/GuRentalForms.tsx']){
    assert.match(readFileSync(root+file,'utf8'),/GuMoneyInput/);
  }
  const component=readFileSync(root+'components/GuMoneyInput.tsx','utf8');
  assert.match(component,/onValueChange\(raw\)/);
  assert.match(component,/inputMode="numeric"/);
});
test('GU system shows VPS capacity and images only once, with diagnostics collapsed',()=>{
 const admin=readFileSync('src/components/GuSystem.tsx','utf8');
 assert.match(admin,/Hệ thống & lưu trữ/);
 assert.match(admin,/Dung lượng VPS/);
 assert.match(admin,/Còn trống/);
 assert.match(admin,/Ảnh GU:/);
 assert.match(admin,/Số ảnh:/);
 assert.match(admin,/<details className="panel gu-system-storage-extra"/);
 assert.doesNotMatch(admin,/Dung lượng & băng thông|cloudinary-only|monitoring\.viewer|Firebase Firestore/);
 const detail=readFileSync('src/components/GuV5Review.tsx','utf8');
 assert.match(detail,/gu-order-more/);
 assert.match(detail,/Thông tin & thao tác khác/);
 assert.ok(detail.indexOf('gu-v11-capture-button')<detail.indexOf('gu-order-more'));
});
