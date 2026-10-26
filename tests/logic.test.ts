import test from 'node:test';
import assert from 'node:assert/strict';
import {overlap,normalizeVN,bookingDays,rentalBalance} from '../src/lib/logic.ts';
test('Khoảng giao nhau bị chặn, khoảng tiếp giáp cho phép',()=>{assert.equal(overlap(10,20,15,25),true);assert.equal(overlap(10,20,20,25),false);});
test('Tìm kiếm tên sản phẩm không dấu',()=>assert.equal(normalizeVN('Áo dài Xanh Lá'),'ao dai xanh la'));
test('Đếm ngày thuê không chia giờ thành zero',()=>{assert.equal(bookingDays(0,60*60*1000),1);assert.equal(bookingDays(0,2*86400000),2);});
test('Công nợ tối thiểu bằng không',()=>{assert.equal(rentalBalance(100,150),0);assert.equal(rentalBalance(100,20),80);});
