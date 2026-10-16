import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDebtSummary} from '../src/lib/debts.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const make=(p:Partial<RentalOrder>):RentalOrder=>({
 id:'o1',code:'GU-1',customerId:'c1',customerName:'Mai',customerPhone:'0901000001',
 pickupDate:'2026-10-10',returnDate:'2026-10-12',rentalDays:3,lines:[],total:300000,paid:0,depositDue:0,
 note:'',status:'PICKED_UP',createdAt:'2026-10-09',updatedAt:'2026-10-09',createdBy:'admin',history:[],...p
});
test('đơn đặt trước là dự kiến thu, không phải công nợ',()=>{
 const s=buildDebtSummary([make({status:'RESERVED',paid:100000})]);
 assert.equal(s.totalOutstanding,0);assert.equal(s.reservationUnpaid,200000);assert.equal(s.futureReservations,1);
});
test('gộp công nợ theo khách, thể hiện cả tên, số điện thoại và từng đơn',()=>{
 const s=buildDebtSummary([make({id:'a',total:300000,paid:100000}),make({id:'b',total:600000,paid:200000,status:'RETURNED',lateFeeTotal:200000})]);
 assert.equal(s.accounts.length,1);assert.equal(s.accounts[0].orderCount,2);
 assert.equal(s.accounts[0].outstanding,800000);assert.equal(s.totalOutstanding,800000);
 assert.equal(s.accounts[0].customerPhone,'0901000001');
});
test('hủy hoặc thanh toán đủ không còn là công nợ',()=>{
 const s=buildDebtSummary([make({status:'CANCELLED'}),make({status:'RETURNED',paid:300000,id:'b'})]);
 assert.equal(s.accounts.length,0);assert.equal(s.unpaidOrders,0);
});
test('phí trễ đền bù và phụ phí được tính nhưng không âm',()=>{
 const s=buildDebtSummary([make({status:'RETURNED',lateFeeTotal:50000,otherFeeTotal:30000,compensationTotal:200000,paid:90000})]);
 assert.equal(s.totalOutstanding,490000);
});
