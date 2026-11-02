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

test('future-only filters do not classify October overdue pickup as December booking',()=>{
 const old={...base,status:'RESERVED' as const,pickupDate:'2026-10-30',returnDate:'2026-10-31',pickupAt:'2026-10-30T09:04:00Z'};
 const now=Date.parse('2026-11-02T03:30:00Z');
 assert.equal(calendarItemState(item,[old],'2026-12-01',7,'2026-11-02',now),'FREE');
 assert.equal(calendarItemState(item,[old],'2026-11-02',7,'2026-11-02',now),'PICKUP_LATE');
});

test('global future-week pagination does not include old overdue orders under status filters',async()=>{
 const {globalCalendarPage}=await import('../src/lib/calendar-global-page.ts');
 const i={...item,id:'ABCDEFGHIJKL',name:'Váy xanh',category:'Áo dài',sku:'GU-00001',color:'',dailyRate:50000,
   createdAt:'2026-10-30',size:'',bufferDays:0} as InventoryItem;
 const old={...base,id:'past',status:'RESERVED' as const,pickupDate:'2026-10-30',returnDate:'2026-10-31',
   pickupAt:'2026-10-30T09:00:00Z'};
 const page=globalCalendarPage({items:[i],orders:[old],start:'2026-12-01',today:'2026-11-02',
   group:'CLOTHING',page:1,status:'PICKUP_LATE'});
 assert.equal(page.total,0,'December should not list October missed pickups as December bookings');
});
