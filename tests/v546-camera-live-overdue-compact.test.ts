import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {RentalOrder,InventoryItem} from '../src/lib/types.ts';
import {cameraLateAlert,cameraLiveQuote} from '../src/lib/camera-live-status.ts';
import {calendarSlotState} from '../src/lib/calendar-presentation.ts';
import {calendarItemState} from '../src/lib/smart-calendar.ts';

const start='2026-10-28T01:00:00.000Z'; // 08:00 Viet Nam
const returnAt='2026-10-28T04:00:00.000Z'; // 11:00 Viet Nam, same day
const when=(minutes:number)=>new Date(Date.parse(returnAt)+minutes*60_000).toISOString();
const cameraOrder={
 id:'ord-cam-1',code:'GU-TEST',customerId:'c1',customerName:'Đạt',customerPhone:'090',
 pickupDate:'2026-10-28',returnDate:'2026-10-28',rentalDays:1,
 lines:[{itemId:'cam-1',name:'Canon R50',sku:'CAM-1',category:'Máy ảnh',size:'',dailyRate:0,bufferDays:0,replacementValue:4000000,
 cameraModel:'Canon EOS R50',cameraPackageHours:3,cameraPackageBasePrice:110000,lineTotal:110000,startAt:start}],
 pickupAt:start,returnAt,total:110000,paid:0,depositDue:0,status:'PICKED_UP',createdAt:start,updatedAt:start,createdBy:'staff',note:''
} as RentalOrder;
const item={id:'cam-1',name:'Canon R50',category:'Máy ảnh',size:'',color:'',sku:'CAM-1',dailyRate:0,bufferDays:0,replacementValue:4000000,status:'RENTED',createdAt:start} as InventoryItem;

test('3-hour camera overdue warning starts on the same calendar day, one minute late',()=>{
 assert.equal(cameraLateAlert(cameraOrder,when(0)),null);
 assert.equal(cameraLateAlert(cameraOrder,when(1))?.lateMinutes,1);
 assert.equal(calendarSlotState(item,'2026-10-28',[cameraOrder],'2026-10-28',new Set(),Date.parse(when(1))).visual.label,'Trả trễ');
 assert.equal(calendarItemState(item,[cameraOrder],'2026-10-28',7,'2026-10-28',Date.parse(when(1))),'OVERDUE');
 assert.equal(calendarSlotState(item,'2026-10-28',[cameraOrder],'2026-10-28',new Set(),Date.parse(when(-1))).visual.label,'Đã lấy');
});

test('live estimate matches exact 3h camera package pricing, without mutating booked amount',()=>{
 assert.equal(cameraLiveQuote(cameraOrder,when(1))?.total,120000);
 assert.equal(cameraLiveQuote(cameraOrder,when(60))?.total,120000);
 assert.equal(cameraLiveQuote(cameraOrder,when(61))?.total,130000);
 assert.equal(cameraLiveQuote({...cameraOrder,paid:30000},when(61))?.unpaid,100000);
 assert.equal(cameraOrder.total,110000);
});

test('scheduled return time triggers alert, but a shorter booking does not create invented tier fees',()=>{
 const order={...cameraOrder,returnAt:'2026-10-28T03:00:00.000Z',lines:[{...cameraOrder.lines[0],cameraPackageHours:6 as const,cameraPackageBasePrice:130000,lineTotal:130000}],total:130000};
 assert.equal(cameraLateAlert(order,'2026-10-28T03:01:00Z')?.lateMinutes,1);
 assert.equal(cameraLiveQuote(order,'2026-10-28T03:01:00Z')?.lateFee,0);
});

test('returned orders or clothing orders cannot trigger hourly live camera alerts',()=>{
 assert.equal(cameraLateAlert({...cameraOrder,status:'RETURNED'},when(99)),null);
 assert.equal(cameraLiveQuote({...cameraOrder,status:'RETURNED'},when(99)),null);
 assert.equal(cameraLateAlert({...cameraOrder,lines:[{...cameraOrder.lines[0],category:'Trang phục'}]},when(99)),null);
});

test('camera payment cannot collect an outdated pre-return amount once time is overdue',()=>{
 const server=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');
 const detail=readFileSync('src/components/GuV5Review.tsx','utf8');
 const capture=readFileSync('src/components/GuOrderCapture.tsx','utf8');
 assert.match(server,/if\(cameraLateAlert\(order,now\)\)throw new ApiError\(409/);
 assert.match(detail,/cameraLiveQuote\(order,cameraClock\)/);
 assert.match(detail,/!cameraAlert&&extraCashNeeded>0/);
 assert.match(capture,/cameraOvertimeFeeTotal/);
 assert.match(capture,/settling\?'Nhận trả · Quyết toán'/);
});

test('camera live estimate honors persisted billing start even for reserved orders',()=>{
 const early='2026-10-28T00:00:00.000Z'; // 07:00 actual, 08:00 scheduled
 const prebooked={...cameraOrder,bookingKind:'RESERVE' as const,scheduledPickupAt:start,lines:[{...cameraOrder.lines[0],startAt:early}]};
 assert.equal(cameraLiveQuote(prebooked,when(1))?.total,130000); // 07:00 -> 11:01 = 4h01m
});
