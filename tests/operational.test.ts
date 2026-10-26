import test from 'node:test';
import assert from 'node:assert/strict';
import {busyItemIds,findNextDayHandoverRisks,vnDate,vnHour,type OrderSummary} from '../src/lib/operational.ts';
const old: OrderSummary = {id:'A',code:'GU-A',status:'PICKED_UP',pickup_at:'2026-10-25T02:00:00Z',return_at:'2026-10-26T11:00:00Z',customer_name:'Khách A',lines:[{itemId:'jacket',name:'Áo dài xanh'}]};
const upcoming: OrderSummary = {id:'B',code:'GU-B',status:'RESERVED',pickup_at:'2026-10-27T02:00:00Z',return_at:'2026-10-28T11:00:00Z',customer_name:'Khách B',lines:[{itemId:'jacket',name:'Áo dài xanh'}]};
const before = new Date('2026-10-26T09:59:59Z');
const after = new Date('2026-10-26T10:00:00Z');
test('17h Vietnam is the escalation boundary, independent of server timezone', () => {
  assert.equal(vnHour(before),16); assert.equal(vnHour(after),17);
  assert.equal(vnDate(after),'2026-10-26');
  assert.equal(findNextDayHandoverRisks([old,upcoming],before).length,0);
  assert.equal(findNextDayHandoverRisks([old,upcoming],after).length,1);
});
test('risk identifies affected item and both orders', () => {
  const [risk] = findNextDayHandoverRisks([old,upcoming],after);
  assert.equal(risk.currentCode,'GU-A');assert.equal(risk.nextCode,'GU-B');
  assert.deepEqual(risk.itemNames,['Áo dài xanh']);
});
test('already returned order never raises next-day warning', () => {
  assert.equal(findNextDayHandoverRisks([{...old,status:'RETURNED'},upcoming],after).length,0);
});
test('overlap is half-open; adjacent bookings allowed', () => {
  assert.equal(busyItemIds([upcoming],'2026-10-27T09:00:00Z','2026-10-28T09:00:00Z').has('jacket'),true);
  assert.equal(busyItemIds([upcoming],'2026-10-28T11:00:00Z','2026-10-29T09:00:00Z').has('jacket'),false);
});
test('cancelled orders do not block rental dates',()=>{
  assert.equal(busyItemIds([{...upcoming,status:'CANCELLED'}],'2026-10-27T02:00:00Z','2026-10-27T03:00:00Z').size,0);
});
