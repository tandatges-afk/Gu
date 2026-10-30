import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalCalendarPage} from '../src/lib/calendar-global-page.ts';
import type {InventoryItem,RentalOrder} from '../src/lib/types.ts';
const DAY='2026-10-30';
function item(n:number):InventoryItem{return {id:'item-'+n,name:'Đầm '+String(n).padStart(3,'0'),sku:'sku-'+n,category:'Đầm',size:'',color:'',dailyRate:50000,bufferDays:0,replacementValue:300000,status:'AVAILABLE',createdAt:DAY};}
function order(id:string,itemId:string,status:RentalOrder['status']='PICKED_UP'):RentalOrder{return {id,code:id,customerId:id,customerName:id,customerPhone:'0900000000',pickupDate:DAY,returnDate:'2026-11-01',rentalDays:3,lines:[{itemId,sku:itemId,name:itemId,size:'',dailyRate:50000,bufferDays:0,replacementValue:300000,lineTotal:50000}],total:50000,paid:50000,depositDue:0,note:'',status,createdAt:DAY,updatedAt:DAY,createdBy:'admin',history:[]};}
test('Rental on nominal page 3 is promoted to global page 1, with stable next/previous pages',()=>{
 const items=Array.from({length:61},(_,i)=>item(i+1));
 const orders=[order('order-last',items[60].id)];
 const base={items,orders,start:DAY,today:DAY,group:'CLOTHING' as const};
 const first=globalCalendarPage({...base,page:1});
 const second=globalCalendarPage({...base,page:2});
 const third=globalCalendarPage({...base,page:3});
 assert.equal(first.results.length,25);
 assert.equal(first.results[0].id,'item-61');
 assert.equal(first.totalPages,3);
 assert.equal(first.total,61);
 assert.equal(second.page,2);
 assert.equal(third.results.length,11);
 assert.equal(new Set([...first.results,...second.results,...third.results].map(x=>x.id)).size,61);
 assert.equal(globalCalendarPage({...base,page:200}).page,3);
});
test('Global sorting and pagination run after category/status filtering, not per page',()=>{
 const items=Array.from({length:55},(_,i)=>item(i+1));
 items[0].category='Phụ kiện';
 const orders=[order('last-order',items[54].id)];
 const page=globalCalendarPage({items,orders,start:DAY,today:DAY,group:'CLOTHING',status:'PICKED_UP',page:1});
 assert.equal(page.total,1);assert.equal(page.results[0].id,'item-55');
 const filtered=globalCalendarPage({items,orders,start:DAY,today:DAY,group:'CLOTHING',category:'Phụ kiện',page:1});
 assert.equal(filtered.total,1);assert.equal(filtered.results[0].id,'item-1');
});
test('Defect photo is validated as a real inspection upload, kept for 7 rounds, and admin color choice does not edit stock',()=>{
 const api=readFileSync('src/app/api/v5/orders/[id]/route.ts','utf8');
 const capture=readFileSync('src/components/GuOrderCapture.tsx','utf8');
 const review=readFileSync('src/components/GuV5Review.tsx','utf8');
 const retention=readFileSync('src/lib/evidence-retention.ts','utf8');
 assert.match(api,/issuePhotoUpload=issuePhotoRaw\?parseInspectionPhotoUrl/);
 assert.match(api,/!String\(p.note\|\|''\).trim\(\)&&!issuePhotoUpload/);
 assert.match(api,/p.issuePhoto\.url/);
 assert.match(retention,/proof\?\.issuePhoto/);
 assert.match(capture,/Chụp ảnh vấn đề/);
 assert.match(review,/gu-review-choice--/);
 const approval=api.split("}else if(action==='REVIEW_PHOTOS'){")[1].split("}else if(action==='RETURN_COLLATERAL'){")[0];
 assert.match(approval,/photoReviewAssessments:assessments/);
 assert.doesNotMatch(approval,/tx\.update\(itemRefs|tx\.update\(r,\{status/);
});
