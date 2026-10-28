import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expectedReturnAfterHandover} from '../src/lib/handover-return-time.ts';
import {MAX_BULK_ITEMS,validateBulkNames} from '../src/lib/bulk-inventory-rules.ts';
import {cameraQuoteForLine} from '../src/lib/camera-rental.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const source=(file:string)=>readFileSync(file,'utf8');
const start='2026-10-28T21:30:00.000Z'; // 04:30 Vietnam on 29th
const planned='2026-10-28T22:00:00.000Z';
const add=(iso:string,hours:number)=>new Date(Date.parse(iso)+hours*3600000).toISOString();
function order(group:'CAMERA'|'CLOTHING',hours:number,days=1){
 const camera=group==='CAMERA';
 return {pickupAt:planned,returnAt:add(planned,camera?hours:days*24),rentalDays:days,rentalGroup:group,
  lines:[{itemId:'device',category:camera?'Máy ảnh':'Trang phục',...(camera?{cameraModel:'Canon EOS R50',cameraPackageHours:hours,cameraPackageBasePrice:110000}:{})}]
 } as RentalOrder;
}
test('Rev7.8: 100 inventory rows per save with duplicate detection unchanged',()=>{
 assert.equal(MAX_BULK_ITEMS,100);
 const names=Array.from({length:100},(_,i)=>`Món ${i+1}`);
 assert.equal(validateBulkNames(names).length,0);
 assert.equal(validateBulkNames([...names.slice(0,99),'mon 1'])[0].code,'DUPLICATE');
 const bulk=source('src/app/api/items/bulk/route.ts');
 assert.match(bulk,/runTransaction/);assert.match(bulk,/MAX_BULK_ITEMS/);assert.match(bulk,/jsonBody\(req,256_000\)/);
});
test('Rev7.8: clothes 1 day = exactly 24h after handover, even if early or late and crossing midnight',()=>{
 const sample=order('CLOTHING',0,1);
 assert.equal(expectedReturnAfterHandover(sample,start),add(start,24));
 assert.equal(expectedReturnAfterHandover(sample,add(planned,2)),add(planned,26));
});
test('Rev7.8: clothes multiple days respect exact 24-hour cycles',()=>{
 for(const days of [1,2,5,30]){
  assert.equal(expectedReturnAfterHandover(order('CLOTHING',0,days),start),add(start,days*24));
 }
});
test('Rev7.8: each camera package expires at handover + selected hours, overtime after that',()=>{
 for(const hours of [3,6,24,48]){
  const o=order('CAMERA',hours);
  const due=expectedReturnAfterHandover(o,start);
  assert.equal(due,add(start,hours));
  assert.equal(cameraQuoteForLine(o.lines[0],start,due).lateFee,0);
  assert.equal(cameraQuoteForLine(o.lines[0],start,add(due,1/60)).lateFee,10000);
 }
});
test('Rev7.8: concurrency-safe rebasing keeps original appointment and updates job/return date atomically',()=>{
 const api=source('src/app/api/v5/orders/[id]/route.ts');
 const locks=source('src/lib/v5-server.ts');
 for(const token of ['rebaseHandoverIntervals(tx,order,now,actualReturnAt)','writeRebasedSlots()','scheduledPickupAt:order.scheduledPickupAt||order.pickupAt','returnAt:actualReturnAt','returnDate:vnDayKey(actualReturnAt)'])assert.ok(api.includes(token),token);
 for(const token of ['tx.get(slot.ref)','legacy[i].exists','overlap(other.start,other.end','tx.delete(slot.ref)'])assert.ok(locks.includes(token),token);
});
test('Rev7.8: compact list supports search/filter/collapse and has higher density',()=>{
 const ui=source('src/components/GuBulkInventory.tsx');
 const css=source('src/components/GuBulkInventory.module.css');
 for(const x of ['rowQuery','onlyIncomplete','setExpanded','visibleRows','Thu gọn tất cả'])assert.ok(ui.includes(x),x);
 assert.match(css,/max-height:min\(62vh,660px\)/);
});
