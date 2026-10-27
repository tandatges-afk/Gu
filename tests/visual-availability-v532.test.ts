import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visualUpcomingForItem,visibleStockLabel,vietnamDayPlus} from '../src/lib/visual-availability.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const now=new Date('2026-10-20T05:00:00.000Z'); // VN 12:00 on 20 Oct
const makeOrder=(id:string,pickupAt:string,status:RentalOrder['status']='RESERVED',itemId='item-000000001'):RentalOrder=>({
 id,code:id,customerId:'private',customerName:'Never expose',customerPhone:'0912345678',
 pickupDate:pickupAt.slice(0,10),returnDate:pickupAt.slice(0,10),pickupAt:new Date(pickupAt+':00+07:00').toISOString(),
 returnAt:new Date(Date.parse(pickupAt+':00+07:00')+86400000).toISOString(),
 lines:[{itemId,name:'Áo',sku:'',size:'',dailyRate:50000,bufferDays:0,replacementValue:0,lineTotal:50000}],
 rentalDays:1,total:50000,paid:0,depositDue:0,status,createdAt:now.toISOString(),updatedAt:now.toISOString(),createdBy:'staff',note:'',history:[]
});
test('upcoming image match only shows uncompleted bookings starting within next seven VN calendar days',()=>{
 const orders=[makeOrder('one','2026-10-20T14:00'),makeOrder('next','2026-10-26T09:00'),makeOrder('outside','2026-10-27T09:00'),makeOrder('past','2026-10-20T11:00'),makeOrder('closed','2026-10-22T10:00','CANCELLED')];
 const r=visualUpcomingForItem(orders,'item-000000001',now);
 assert.deepEqual(r.map(x=>x.orderId),['one','next']);
 assert.equal(r[0].pickupAt,'2026-10-20T07:00:00.000Z');
 assert.ok(!('customerPhone' in r[0]));
});
test('show only bookings of matching product, deduplicate and preserve unavailable state',()=>{
 const a=makeOrder('same','2026-10-22T15:00');const b=makeOrder('different','2026-10-22T16:00','RESERVED','item-000000002');
 assert.equal(visualUpcomingForItem([a,a,b],'item-000000001',now).length,1);
 assert.equal(visibleStockLabel('AVAILABLE'),'Còn trống');
 assert.equal(visibleStockLabel('RENTED'),'Đang thuê');
 assert.equal(visibleStockLabel('LAUNDRY'),'Đang giặt');
 assert.equal(vietnamDayPlus('2026-10-31',7),'2026-11-07');
});
test('availability endpoint requires login and returns only status plus booking dates',()=>{
 const route=readFileSync('src/app/api/v5/visual-availability/route.ts','utf8');
 assert.match(route,/await staffUser\(req\)/);
 assert.match(route,/visualUpcomingForItem/);
 assert.match(route,/itemIds/);
 assert.doesNotMatch(route,/customerName:/);
 assert.doesNotMatch(route,/customerPhone:/);
});
test('UI removes duplicate smart search and offers distinct risk color and dismiss button',()=>{
 const page=readFileSync('src/app/page.tsx','utf8');const css=readFileSync('src/app/globals.css','utf8');
 assert.doesNotMatch(page,/className="panel gu-smart-calendar"/);
 assert.match(page,/className="gu-search-wrap"/);
 assert.match(page,/setDismissedRiskSignature\(riskSignature\)/);
 assert.match(css,/\.gu-next-day-risk\{/);
});
