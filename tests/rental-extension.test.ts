import assert from 'node:assert/strict';
import test from 'node:test';
import {planRentalExtension} from '../src/lib/rental-extension.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const base={status:'PICKED_UP',pickupDate:'2026-10-20',returnDate:'2026-10-21',total:600000,lines:[{itemId:'abcdefghijkl',name:'Áo dài',sku:'GU1',size:'M',dailyRate:300000,bufferDays:0,replacementValue:1500000,lineTotal:600000,startDate:'2026-10-20'}]} as Pick<RentalOrder,'status'|'pickupDate'|'returnDate'|'lines'|'total'>;
test('gia hạn 2 ngày cộng đúng tiền và khóa từng ngày mới',()=>{
 const plan=planRentalExtension(base,'2026-10-23','2026-10-20');
 assert.equal(plan.addedDays,2);assert.equal(plan.rentalDays,4);assert.equal(plan.additionalTotal,600000);
 assert.equal(plan.newTotal,1200000);assert.equal(plan.newLines[0].lineTotal,1200000);
 assert.deepEqual(plan.additionalSlots.map(x=>x.day),['2026-10-22','2026-10-23']);
});
test('đệm ngày cũ không tạo lock trùng của chính đơn thuê',()=>{
 const legacy={...base,lines:[{...base.lines[0],bufferDays:1}]};
 const plan=planRentalExtension(legacy,'2026-10-22','2026-10-20');
 assert.deepEqual(plan.additionalSlots.map(x=>x.day),['2026-10-23']);
});
test('không gia hạn ngược về ngày cũ, không đổi lịch đơn quá hạn',()=>{
 assert.throws(()=>planRentalExtension(base,'2026-10-21','2026-10-20'));
 assert.throws(()=>planRentalExtension(base,'2026-10-22','2026-10-22'),/quá hạn/);
});
test('không gia hạn đơn đã đóng và không thuê quá 30 ngày',()=>{
 assert.throws(()=>planRentalExtension({...base,status:'RETURNED'},'2026-10-23','2026-10-20'));
 assert.throws(()=>planRentalExtension(base,'2026-11-30','2026-10-20'));
});
test('gia hạn nhiều món, trong đó có món được thêm sau',()=>{
 const extended={...base,lines:[...base.lines,{...base.lines[0],itemId:'bbbbbbbbbbbb',dailyRate:150000,lineTotal:150000,startDate:'2026-10-21'}],total:750000};
 const result=planRentalExtension(extended,'2026-10-22','2026-10-20');
 assert.equal(result.additionalTotal,450000);
 assert.equal(result.newTotal,1200000);
 assert.equal(result.additionalSlots.length,2);
});
