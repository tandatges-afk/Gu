import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orderDayState,itemDayState,matchesCalendarStatus,matchesCalendarCreator,isPickupWarning} from '../src/lib/calendar-timeline.ts';
import type {RentalOrder,InventoryItem} from '../src/lib/types.ts';
const item={id:'item123456789',name:'Váy đen',category:'Chân váy',status:'AVAILABLE',replacementValue:100000} as InventoryItem;
const order=(status:RentalOrder['status'],returnDate='2026-10-23',returnedAt?:string):RentalOrder=>({
 id:'order12345678',code:'O-123',customerId:'c',customerName:'Lan',customerPhone:'0901112222',createdBy:'staff12345678',
 pickupDate:'2026-10-20',returnDate,status,returnedAt,lines:[{itemId:item.id,sku:'G',name:item.name,size:'M',dailyRate:1000,lineTotal:1000,bufferDays:0,replacementValue:100000}],
 rentalDays:3,total:3000,paid:3000,depositDue:0,note:'',createdAt:'2026-10-20T02:00:00Z',updatedAt:'',history:[]
});
test('đã trả ngày 25: ngày 20-24 vẫn ghi đang được thuê; ngày 25 ghi đã trả; 26 không còn chiếm hàng',()=>{
 const finished=order('RETURNED','2026-10-23','2026-10-25T09:00:00Z');
 assert.equal(orderDayState(finished,item.id,'2026-10-22','2026-10-25'),'PICKED_UP');
 assert.equal(orderDayState(finished,item.id,'2026-10-24','2026-10-25'),'PICKED_UP');
 assert.equal(orderDayState(finished,item.id,'2026-10-25','2026-10-25'),'RETURNED');
 assert.equal(orderDayState(finished,item.id,'2026-10-26','2026-10-25'),null);
});
test('đơn đang thuê qua hạn không bị vẽ thành ô trống khi chuyển về ngày cũ hoặc tới ngày mai',()=>{
 const held=order('PICKED_UP');
 assert.equal(itemDayState(item,[held],'2026-10-22','2026-10-25'),'PICKED_UP');
 assert.equal(itemDayState(item,[held],'2026-10-24','2026-10-25'),'OVERDUE');
 assert.equal(itemDayState(item,[held],'2026-10-27','2026-10-25'),'OVERDUE');
 assert.equal(matchesCalendarStatus(item,[held],'2026-10-21','2026-10-25','PICKED_UP'),true);
 assert.equal(matchesCalendarStatus(item,[held],'2026-10-24','2026-10-25','OVERDUE'),true);
 assert.equal(matchesCalendarCreator(item,[held],'2026-10-20','2026-10-25','staff12345678'),true);
});
test('trạng thái kho hiện tại không áp lên ô ngày trong quá khứ',()=>{
 const washing={...item,status:'LAUNDRY'} as InventoryItem;
 assert.equal(itemDayState(washing,[],'2026-10-23','2026-10-25'),'FREE');
 assert.equal(itemDayState(washing,[],'2026-10-25','2026-10-25'),'LAUNDRY');
});
test('cảnh báo 17h chỉ là màu trong ngày, không phá chiều cao và không giữ sang hôm sau',()=>{
 const reserved={...order('RESERVED','2026-10-26'),pickupDate:'2026-10-25'};
 assert.equal(isPickupWarning(reserved,'2026-10-25',new Date('2026-10-25T09:59:59Z')),false);
 assert.equal(isPickupWarning(reserved,'2026-10-25',new Date('2026-10-25T10:00:00Z')),true);
 assert.equal(isPickupWarning(reserved,'2026-10-25',new Date('2026-10-25T17:00:00Z')),false);
 assert.equal(isPickupWarning(reserved,'2026-10-26',new Date('2026-10-25T11:00:00Z')),false);
 const page=readFileSync('src/app/page.tsx','utf8');
 assert.doesNotMatch(page,/gu-calendar-pickup-warning/);
 assert.doesNotMatch(page,/Sau 17h chưa lấy/);
});
test('lọc toàn kho trước khi phân trang và không đánh tráo 25 sản phẩm là toàn bộ kết quả',()=>{
 const api=readFileSync('src/app/api/calendar/view/route.ts','utf8');
 assert.ok(api.indexOf('const visible=items.filter')<api.indexOf('const selected=fast?visible:visible.slice'));
 assert.match(api,/matchesCalendarStatus/);
 assert.match(api,/matchesCalendarCreator/);
 assert.match(api,/calendarFastPage/);
});
test('ảnh cọc/CCCD mới dùng Cloudinary authenticated, không dùng Firebase Storage',()=>{
 const src=readFileSync('src/lib/secure-evidence.ts','utf8');
 assert.match(src,/uploadAuthenticatedEvidence/);
 assert.match(src,/FIREBASE_STORAGE_BUCKET/); // backward-compatible legacy read only
 assert.match(src,/Cloudinary/);
});
