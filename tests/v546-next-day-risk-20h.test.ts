import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NEXT_DAY_RISK_START_HOUR_VN,tomorrowReturnRisk,overduePickupNotice} from '../src/lib/return-risk.ts';
import type {RentalOrder} from '../src/lib/types.ts';

const atVN=(hh:string)=>new Date(`2026-10-28T${String(Number(hh.slice(0,2))-7).padStart(2,'0')}:${hh.slice(3)}:00Z`);
const order=(id:string,status:RentalOrder['status'],pickupDate:string):RentalOrder=>({
 id,code:id,customerId:'customer',customerName:'Khách thử',customerPhone:'',
 pickupDate,returnDate:pickupDate,rentalDays:1,
 lines:[{itemId:'item-1',name:'Áo',sku:'GU-1',size:'',dailyRate:50000,bufferDays:0,replacementValue:300000,lineTotal:50000}],
 total:50000,paid:0,depositDue:0,note:'',status,createdAt:'2026-10-28',updatedAt:'2026-10-28',createdBy:'staff',history:[]
});
const held=order('held','PICKED_UP','2026-10-28');
const tomorrow=order('tomorrow','RESERVED','2026-10-29');

test('20:00 Asia/Ho_Chi_Minh is the first minute of next-day return warnings',()=>{
 assert.equal(NEXT_DAY_RISK_START_HOUR_VN,20);
 assert.deepEqual(tomorrowReturnRisk([held,tomorrow],atVN('17:00')),[]);
 assert.deepEqual(tomorrowReturnRisk([held,tomorrow],atVN('19:59')),[]);
 assert.deepEqual(tomorrowReturnRisk([held,tomorrow],atVN('20:00')),[{itemId:'item-1',heldOrderId:'held',nextOrderId:'tomorrow'}]);
 assert.deepEqual(tomorrowReturnRisk([held,tomorrow],atVN('23:59')),[{itemId:'item-1',heldOrderId:'held',nextOrderId:'tomorrow'}]);
 assert.deepEqual(tomorrowReturnRisk([held,{...tomorrow,status:'CANCELLED'}],atVN('20:00')),[]);
});
test('Late pickup by appointment is not delayed until 20:00',()=>{
 const missed={...tomorrow,id:'late',pickupDate:'2026-10-28',scheduledPickupAt:'2026-10-28T08:00:00Z'};
 assert.equal(overduePickupNotice(missed,atVN('15:30'))?.orderId,'late');
});
test('API and interface share the threshold; shift hours remain intact',()=>{
 const api=readFileSync('src/app/api/v5/return-risk/route.ts','utf8');
 const ui=readFileSync('src/app/page.tsx','utf8');
 const shifts=readFileSync('src/lib/shift-schedule.ts','utf8');
 assert.match(api,/hour>=NEXT_DAY_RISK_START_HOUR_VN/);
 assert.match(api,/overduePickupNotices\(reservations,now\)/);
 assert.doesNotMatch(api,/if\(hour<20\)return/);
 assert.match(ui,/vnHour>=NEXT_DAY_RISK_START_HOUR_VN/);
 assert.match(ui,/Cảnh báo 20h/);
 assert.match(ui,/Từ 20:00:/);
 assert.doesNotMatch(ui,/Cảnh báo 17h|Sau 17:00:/);
 assert.match(shifts,/end:'17:00'/);
 assert.match(shifts,/start:'17:00'/);
});
