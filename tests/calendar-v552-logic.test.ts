import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarOrdersForDay,hasMissedPickupAt17,overdueHeldOrder} from '../src/lib/calendar-display.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const make=(id:string,status:RentalOrder['status'],pickupDate:string,returnDate:string):RentalOrder=>({
 id,code:id,customerId:'c',customerName:'Khách '+id,customerPhone:'',pickupDate,returnDate,
 status,lines:[{itemId:'item123456789',name:'Chân váy',sku:'G1',size:'M',dailyRate:100,bufferDays:0,replacementValue:100,lineTotal:100}],
 paid:0,total:100,depositDue:0,note:'',createdAt:'',updatedAt:'',createdBy:'s',history:[],rentalDays:1,
});
test('cảnh báo chưa lấy bắt đầu đúng 17h tại Việt Nam và tự hết lúc 00:00',()=>{
 const reserved=make('r','RESERVED','2026-10-25','2026-10-26');
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T09:59:00Z')),false);
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T10:00:00Z')),true);
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T16:59:00Z')),true);
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T17:00:00Z')),false);
 assert.equal(hasMissedPickupAt17({...reserved,status:'PICKED_UP'},new Date('2026-10-25T11:00:00Z')),false);
 assert.equal(hasMissedPickupAt17({...reserved,status:'CANCELLED'},new Date('2026-10-25T11:00:00Z')),false);
});
test('khách hẹn nhận lúc 20h không bị đánh dấu lúc 17h',()=>{
 const reserved={...make('r','RESERVED','2026-10-25','2026-10-26'),pickupAt:'2026-10-25T13:00:00Z'};
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T11:00:00Z')),false);
 assert.equal(hasMissedPickupAt17(reserved,new Date('2026-10-25T13:00:00Z')),true);
});
test('ưu tiên đơn đã giao trên đơn đặt, bỏ đơn hủy/đã trả và không lan sang ngày khác',()=>{
 const reserved=make('reserved','RESERVED','2026-10-25','2026-10-26');
 const picked=make('picked','PICKED_UP','2026-10-25','2026-10-26');
 const returned=make('returned','RETURNED','2026-10-25','2026-10-26');
 assert.deepEqual(calendarOrdersForDay([reserved,returned,picked],'item123456789','2026-10-25').map(o=>o.id),['picked','reserved']);
 assert.deepEqual(calendarOrdersForDay([reserved,picked],'item123456789','2026-10-27'),[]);
 assert.equal(overdueHeldOrder([reserved,picked],'item123456789','2026-10-27')?.id,'picked');
 assert.equal(overdueHeldOrder([reserved,picked],'item123456789','2026-10-26'),undefined);
});
test('giao diện bỏ bảng smart, phân trang có history, không hiển thị xanh khi chưa tải trạng thái',()=>{
 const src=readFileSync('src/app/page.tsx','utf8');
 assert.doesNotMatch(src,/className="panel gu-smart-calendar"/);
 assert.match(src,/calendarCursorTrail/);assert.match(src,/Trang đầu/);assert.match(src,/Trang trước/);assert.match(src,/Trang sau/);
 assert.match(src,/calendarResponseKey/);assert.match(src,/cell-loading/);assert.match(src,/hasMissedPickupAt17/);
});
test('cấu hình index khớp query SUM theo kind và outstanding ở công nợ',()=>{
 const indexes=JSON.parse(readFileSync('firestore.indexes.json','utf8'));
 const matching=indexes.indexes.find((x:{collectionGroup:string;fields:Array<{fieldPath:string;order:string}>})=>x.collectionGroup==='debtLedger'&&x.fields[0]?.fieldPath==='kind'&&x.fields[1]?.fieldPath==='outstanding');
 assert.ok(matching);
});
