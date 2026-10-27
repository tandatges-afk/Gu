import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarItemState,validateSmartRange,nearestFreeStart} from '../src/lib/smart-calendar.ts';
import type {InventoryItem,RentalOrder} from '../src/lib/types.ts';
const item={id:'ABCDEFGHIJKL',status:'AVAILABLE',replacementValue:1000} as InventoryItem;
const base={status:'RESERVED',pickupDate:'2026-10-15',returnDate:'2026-10-16',lines:[{itemId:item.id,startDate:'2026-10-15'}]} as RentalOrder;
test('lọc lịch phân biệt đã đặt, đã giao, trễ và giặt',()=>{
  assert.equal(calendarItemState(item,[base],'2026-10-15',7,'2026-10-15'),'RESERVED');
  assert.equal(calendarItemState(item,[{...base,status:'PICKED_UP'}],'2026-10-15',7,'2026-10-15'),'PICKED_UP');
  assert.equal(calendarItemState(item,[{...base,status:'PICKED_UP'}],'2026-10-17',7,'2026-10-17'),'OVERDUE');
  assert.equal(calendarItemState({...item,status:'LAUNDRY'},[],'2026-10-15',7,'2026-10-15'),'LAUNDRY');
  assert.equal(calendarItemState(item,[],'2026-10-17',7,'2026-10-15'),'FREE');
  assert.equal(calendarItemState({...item,replacementValue:0},[],'2026-10-15',7,'2026-10-15'),'UNPRICED');
});
test('tìm ngày trống gần nhất, giữ chính xác độ dài thuê liên tiếp',()=>{
  const occupied=new Set(['2026-10-15','2026-10-17']);
  assert.equal(nearestFreeStart('2026-10-15',2,occupied),'2026-10-18');
  assert.equal(nearestFreeStart('2026-10-15',1,occupied),'2026-10-16');
  assert.equal(nearestFreeStart('2026-10-15',1,new Set(['2026-10-15']),0),null);
});
test('không tra ngày quá khứ hoặc đơn vượt 30 ngày',()=>{
  assert.equal(validateSmartRange('2026-10-15','2026-10-15','2026-10-15'),1);
  assert.throws(()=>validateSmartRange('2026-10-14','2026-10-14','2026-10-15'));
  assert.throws(()=>validateSmartRange('2026-10-15','2026-11-18','2026-10-15'));
});
