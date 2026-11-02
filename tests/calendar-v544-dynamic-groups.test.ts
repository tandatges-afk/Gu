import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarSlotState,sortCalendarProductsForDay} from '../src/lib/calendar-presentation.ts';
import type {InventoryItem,RentalOrder} from '../src/lib/types.ts';

const day1='2026-10-21',day2='2026-10-22';
function item(id:string,status:InventoryItem['status']='AVAILABLE'):InventoryItem{
 return {id,name:'Sản phẩm '+id,sku:id,category:'Áo dài',size:'',color:'',dailyRate:50000,bufferDays:0,replacementValue:500000,status,createdAt:day1};
}
function order(itemId:string,status:RentalOrder['status'],pickupDate:string,returnDate:string):RentalOrder{
 return {id:'order-'+itemId+'-'+pickupDate,code:'GU-ORDER-'+itemId,customerId:'customer',customerName:'Test',customerPhone:'0900000000',pickupDate,returnDate,rentalDays:1,lines:[{itemId,name:itemId,sku:itemId,size:'',dailyRate:50000,bufferDays:0,replacementValue:500000,lineTotal:50000}],total:50000,paid:50000,depositDue:0,note:'',status,createdAt:day1,updatedAt:day1,createdBy:'staff',history:[]};
}
test('Rows form adjacent status groups for the first displayed day and REGROUP when date moves',()=>{
 const rows=[item('free'),item('picked-a'),item('reserved'),item('picked-b')];
 const orders=[order('picked-a','PICKED_UP',day1,day1),order('picked-b','PICKED_UP',day1,day1),order('picked-b','RESERVED',day2,day2),order('reserved','RESERVED',day1,day1)];
 const todayOrder=sortCalendarProductsForDay(rows,day1,orders,day1).map(i=>i.id);
 assert.deepEqual(todayOrder,['picked-b','picked-a','reserved','free']); // More occupied days first within 'Đã lấy'.
 const tomorrowOrder=sortCalendarProductsForDay(rows,day2,orders,day1).map(i=>i.id);
 assert.deepEqual(tomorrowOrder,['picked-b','free','picked-a','reserved']);
 assert.notDeepEqual(todayOrder,tomorrowOrder);
 assert.deepEqual(rows.map(i=>i.id),['free','picked-a','reserved','picked-b'],'Do not mutate inventory input');
});
test('Late and 20h warning take precedence over active pickups; laundry is not a free slot',()=>{
 const rows=[item('free'),item('laundry','LAUNDRY'),item('warning'),item('late'),item('picked'),item('reserved')];
 const orders=[order('warning','PICKED_UP',day1,day2),order('late','PICKED_UP','2026-10-17','2026-10-19'),order('picked','PICKED_UP',day1,day2),order('reserved','RESERVED',day1,day2)];
 const sorted=sortCalendarProductsForDay(rows,day1,orders,day1,new Set(['warning'])).map(i=>i.id);
 assert.deepEqual(sorted,['late','warning','picked','reserved','laundry','free']);
 assert.equal(calendarSlotState(rows[1],day1,orders,day1).visual.label,'Đang giặt');
});
test('Two bookings in the same date: picked beats reserved and clicking can still see both',()=>{
 const a=item('shared');
 const booked=[order('shared','RESERVED',day1,day1),order('shared','PICKED_UP',day1,day1)];
 const display=calendarSlotState(a,day1,booked,day1);
 assert.equal(display.visual.label,'Đã lấy');
 assert.equal(display.shown?.status,'PICKED_UP');
 assert.equal(display.matching.length,2);
});
test('No labels Hôm nay/Mai/Mốt inside the date headers; available cells only show +',()=>{
 const page=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/GuCalendarTimeline.module.css',import.meta.url),'utf8');
 assert.doesNotMatch(page,/calendarUi\.dayCaption/);
 assert.match(page,/<strong>\{prettyDay\(d\)\}<\/strong><\/div>/);
 assert.match(page,/visual\.className==='stateFree'\?<span className=\{calendarUi\.freeAction\} aria-hidden="true">\+<\/span>/);
 assert.doesNotMatch(page,/\+ Đặt thuê/);
 assert.match(page,/calendar\/page\?/);
 assert.match(page,/calendarItems=calendarBaseItems/);
 assert.match(css,/\.grid :global\(\.calendar-row\)>\.dayTrack/);
 assert.doesNotMatch(css,/\.toneToday\{[^\n]*box-shadow:/);
});

// Audit 6092285: operational alerts must not occupy all future dates.
test('future booking cell is consistent with FREE status while an earlier customer is still out', async()=>{
 const {calendarItemState}=await import('../src/lib/smart-calendar.ts');
 const itemOut=item('future-out','RENTED');
 const old={...order(itemOut.id,'PICKED_UP','2026-11-02','2026-11-03'),
   id:'old-held',returnAt:'2026-11-03T03:25:00Z'};
 const now=Date.parse('2026-11-02T03:30:00Z');
 const future=calendarSlotState(itemOut,'2026-11-06',[old],'2026-11-02',new Set(),now);
 assert.equal(future.blocked,false,'future date outside the contract must not be disabled by physical status alone');
 assert.equal(future.visual.className,'stateFree');
 assert.equal(future.followupRisk,true,'physical handover is still unresolved: show risk marker');
 assert.equal(calendarItemState(itemOut,[old],'2026-11-06',7,'2026-11-02',now),'FREE');
});

test('today next reservation stays visible beside an overdue previous handover',()=>{
 const i=item('shared-next','RENTED');
 const now=Date.parse('2026-11-02T03:30:00Z'); // 10:30 Vietnam
 const old={...order(i.id,'PICKED_UP','2026-11-01','2026-11-02'),
   id:'old-held',customerName:'Khách cũ',returnAt:'2026-11-02T01:00:00Z'};
 const next={...order(i.id,'RESERVED','2026-11-02','2026-11-03'),
   id:'new-booking',customerName:'Khách mới',scheduledPickupAt:'2026-11-02T04:00:00Z'};
 const slot=calendarSlotState(i,'2026-11-02',[old,next],'2026-11-02',new Set(),now);
 assert.equal(slot.shown?.id,'new-booking','next customer cannot disappear behind older handover');
 assert.equal(slot.late,true,'red alert must not disappear when a new reservation exists');
 assert.equal(slot.followupRisk,true,'staff must see the stock conflict');
 assert.equal(slot.visual.className,'stateOverdue');
 assert.deepEqual(new Set(slot.matching.map(o=>o.id)),new Set(['old-held','new-booking']));
});

test('historical overdue order does not impersonate future December bookings',async()=>{
 const {calendarItemState}=await import('../src/lib/smart-calendar.ts');
 const old={...order('old-only','PICKED_UP','2026-10-30','2026-10-31'),id:'old-oct',returnAt:'2026-10-31T09:01:00Z'};
 const i=item('old-only','RENTED');
 const now=Date.parse('2026-11-02T03:30:00Z');
 assert.equal(calendarItemState(i,[old],'2026-12-01',7,'2026-11-02',now),'FREE');
 const slot=calendarSlotState(i,'2026-12-01',[old],'2026-11-02',new Set(),now);
 assert.equal(slot.shown,undefined);
 assert.equal(slot.visual.className,'stateFree');
 assert.equal(slot.followupRisk,true,'warn about unresolved possession, never invent a December rental');
});
