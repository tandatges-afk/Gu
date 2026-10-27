import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {productSearchText,productSearchBigrams,matchesProductSearch} from '../src/lib/product-search.ts';
import {vnClock,nextDay,tomorrowReturnRisk} from '../src/lib/return-risk.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const read=(path:string)=>readFileSync(path,'utf8');
function mockOrder(id:string,status:RentalOrder['status'],pickupDate:string,returnDate:string,itemId:string):RentalOrder{
 return {id,code:id,customerId:'c',customerName:'Khách',customerPhone:'0901234567',pickupDate,returnDate,rentalDays:1,lines:[{itemId,name:'Áo dài xanh lá',sku:'GU-1',size:'Một size',dailyRate:50000,bufferDays:0,replacementValue:500000,lineTotal:50000}],total:50000,paid:0,depositDue:0,note:'',status,createdAt:'2026-10-19',updatedAt:'2026-10-19',createdBy:'s',history:[]};
}
test('search anywhere and ignores all Vietnamese marks and case',()=>{
 for(const q of ['Áo','áo','ao','AO','xanh','XANH','lá','la','dài','dai','anh'])assert.ok(matchesProductSearch('Áo dài xanh lá',q),q);
 assert.equal(productSearchText('ÁO DÀI XANH LÁ'),'ao dai xanh la');
 assert.ok(productSearchBigrams('Áo dài xanh lá').includes('xa'));
 assert.ok(!matchesProductSearch('Áo dài xanh lá','đầm'));
});
test('clicked calendar day passes to v5 booking datetime and return is next day',()=>{
 const page=read('src/app/page.tsx'),booking=read('src/components/GuV5Booking.tsx');
 assert.match(page,/openBooking\(day===today\?'PICKUP':'RESERVE',item\.id,day\)/);
 assert.match(booking,/initialTimes\(initial\.pickupDate,initial\.returnDate,initial\.pickupHour,initial\.returnHour\)\.pickup/);
 assert.match(booking,/setUTCDate\(next\.getUTCDate\(\)\+1\)/);
});
test('phone matches existing customer results and offers explicit selection',()=>{
 const booking=read('src/components/GuV5Booking.tsx');
 assert.match(booking,/customers\?phone=/);assert.match(booking,/onClick=\{\(\)=>\{setCustomerId\(c\.id\)/);
 assert.match(booking,/gu-v11-customer-result/);
});
test('risk only after 17h VN when product held and another rental starts tomorrow',()=>{
 const held=mockOrder('h','PICKED_UP','2026-10-19','2026-10-19','item-1');
 const booked=mockOrder('b','RESERVED','2026-10-20','2026-10-20','item-1');
 const date=(hour:number)=>new Date(`2026-10-19T${String(hour-7).padStart(2,'0')}:00:00Z`);
 assert.deepEqual(tomorrowReturnRisk([held,booked],date(16)),[]);
 assert.deepEqual(tomorrowReturnRisk([held,booked],date(17)),[{itemId:'item-1',heldOrderId:'h',nextOrderId:'b'}]);
 assert.deepEqual(tomorrowReturnRisk([{...held,returnDate:'2026-10-22'},booked],date(17)),[{itemId:'item-1',heldOrderId:'h',nextOrderId:'b'}]);
 assert.deepEqual(tomorrowReturnRisk([held,{...booked,lines:booked.lines.map(l=>({...l,itemId:'other'}))}],date(18)),[]);
 assert.equal(vnClock(date(17)).hour,17);assert.equal(nextDay('2026-10-31'),'2026-11-01');
});
test('single responsive staff UI and capture; no separate mobile webpage',()=>{
 assert.equal(existsSync('src/app/mobile/page.tsx'),false);
 const main=read('src/app/page.tsx'),capture=read('src/components/GuOrderCapture.tsx'),api=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(main,/GuOrderCapture/);assert.match(capture,/preparePhonePhoto/);
 for(const step of ['HANDOVER','HANDOVER_EXTRA','RECEIVE'])assert.ok(capture.includes(step));
 assert.match(api,/requireAdmin\(me\)/);assert.match(read('src/app/api/uploads/route.ts'),/verifyIdToken|staffUser/);
});
test('indexed normalized middle-of-name search has server & migration support',()=>{
 assert.match(read('src/app/api/catalog/route.ts'),/nameSearchBigrams/);
 assert.match(read('scripts/migrate-product-names.mjs'),/nameSearchBigrams/);
 assert.match(read('src/app/api/items/route.ts'),/nameSearchBigrams/);
 assert.match(read('src/app/api/items/[id]/route.ts'),/nameSearchBigrams/);
});
