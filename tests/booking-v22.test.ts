import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays, daysInclusive, occupiedDays, requiresLaundry, normalizePhone, assertSlotCapacity} from '../src/lib/rental.ts';
import {bookingMode, verifyImmediatePickup,extraStartDate,lineOccupiedDays,makeAddedLines,mustBeReadyAtPickup} from '../src/lib/booking-rules.ts';
import type {InventoryItem, RentalOrder, RentalLine} from '../src/lib/types.ts';

function item(id:string):InventoryItem{return {id,name:'Áo dài',sku:'GU-001',category:'Áo dài',size:'M',color:'Đỏ',dailyRate:100000,bufferDays:0,replacementValue:850000,requiresLaundry:true,status:'AVAILABLE',createdAt:'2026-01-01'};}
const today='2026-10-15';
test('Thuê 1 ngày: ngày nhận = ngày trả, không phát sinh ngày thứ hai',()=>{
  assert.equal(daysInclusive(today,today),1);
  assert.deepEqual(occupiedDays(today,today,0),[today]);
  assert.deepEqual(occupiedDays(today,today,1),[today,addDays(today,1)]);
});
test('Giặt sau trả được điều khiển độc lập với ngày đệm',()=>{
  assert.equal(requiresLaundry({requiresLaundry:true,bufferDays:0}),true);
  assert.equal(requiresLaundry({requiresLaundry:false,bufferDays:2}),false);
  assert.equal(requiresLaundry({bufferDays:1}),true);
});
test('Cả hai chế độ đơn phải rõ ràng; đơn giao ngay chỉ cho phép nhận trong ngày',()=>{
  assert.equal(bookingMode('RESERVE'),'RESERVE');
  assert.equal(bookingMode('PICKUP'),'PICKUP');
  assert.throws(()=>bookingMode('OTHER'));
  assert.doesNotThrow(()=>verifyImmediatePickup('PICKUP',today,today));
  assert.throws(()=>verifyImmediatePickup('PICKUP',addDays(today,1),today));
  assert.doesNotThrow(()=>verifyImmediatePickup('RESERVE',addDays(today,1),today));
});
test('Giao thêm đồ trong đơn đang thuê chỉ tính số ngày còn lại',()=>{
  const order={status:'PICKED_UP',pickupDate:'2026-10-12',returnDate:'2026-10-17'} as RentalOrder;
  assert.equal(extraStartDate(order,today),today);
  const lines=makeAddedLines([item('aaaaaaaaaa')],today,order.returnDate);
  assert.equal(lines[0].lineTotal,300000);
  assert.equal(lines[0].startDate,today);
  assert.deepEqual(lineOccupiedDays(lines[0],order),[today,'2026-10-16','2026-10-17']);
  assert.equal(extraStartDate({...order,status:'RESERVED'},today),'2026-10-12');
  assert.throws(()=>extraStartDate({...order,status:'RETURNED'},today));
});
test('Không giao hàng đang giặt hoặc đã cho thuê cho khách đến lấy',()=>{
  assert.throws(()=>mustBeReadyAtPickup([{...item('aaaaaaaaaa'),status:'LAUNDRY'}]));
  assert.throws(()=>mustBeReadyAtPickup([{...item('aaaaaaaaaa'),status:'RENTED'}]));
  assert.doesNotThrow(()=>mustBeReadyAtPickup([item('aaaaaaaaaa')]));
});
test('Không giới hạn 5 sản phẩm; áp dụng giới hạn giao dịch Firestore theo số ô lịch',()=>{
  const many=Array.from({length:10},(_,i)=>item(String(i).padStart(10,'0')));
  assert.equal(makeAddedLines(many,today,today).length,10);
  assert.doesNotThrow(()=>assertSlotCapacity(400));
  assert.throws(()=>assertSlotCapacity(401));
});
test('Số điện thoại được chuẩn hóa trước khi đối chiếu',()=>{
  assert.equal(normalizePhone('090 123 4567'),'0901234567');
  assert.equal(normalizePhone('+84901234567'),'0901234567');
  assert.throws(()=>normalizePhone('xin chao'));
});
