import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeDebtPages} from '../src/lib/debt-page-merge.ts';
import type {DebtSummary,DebtAccount,DebtOrder} from '../src/lib/debts.ts';
const order=(id:string,outstanding:number):DebtOrder=>({id,code:id,customerId:'person',customerName:'Khách',customerPhone:'0900000000',status:'PICKED_UP',pickupDate:'2026-10-20',returnDate:'2026-10-21',amount:outstanding,paid:0,outstanding});
const account=(key:string,orders:DebtOrder[]):DebtAccount=>({key,customerId:key,customerName:key,customerPhone:'0900000000',orders,orderCount:orders.length,outstanding:orders.reduce((s,o)=>s+o.outstanding,0)});
const page=(accounts:DebtAccount[],cursor:string|null):DebtSummary=>({accounts,cursor,totalOutstanding:999,unpaidOrders:9,futureReservations:2,reservationUnpaid:100,pendingCameraLateCount:1});
test('Debt pagination merges across shared accounts, deduplicates and keeps global aggregates',()=>{
 const first=page([account('person',[order('a',100),order('b',200)])],'next');
 const second=page([account('person',[order('b',200),order('c',50)]),account('new',[order('d',30)])],null);
 const merged=mergeDebtPages(first,second);
 assert.equal(merged.accounts[0].orderCount,3);
 assert.equal(merged.accounts[0].outstanding,350);
 assert.deepEqual(merged.accounts[0].orders.map(o=>o.id),['a','b','c']);
 assert.equal(merged.accounts[1].outstanding,30);
 assert.equal(merged.totalOutstanding,999);
 assert.equal(merged.cursor,null);
 assert.equal(first.accounts[0].orders.length,2);
 assert.equal(second.accounts[0].orders.length,2);
});
test('bootstrap safely accesses staff doc with optional data',()=>{
 assert.match(readFileSync('src/app/api/bootstrap/route.ts','utf8'),/d\.data\(\)\?\.name/);
});
