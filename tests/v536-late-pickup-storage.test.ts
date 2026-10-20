import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overduePickupNotice,overduePickupNotices} from '../src/lib/return-risk.ts';
import type {RentalOrder} from '../src/lib/types.ts';
const order=(patch:Partial<RentalOrder>={})=>({id:'o1',code:'GU-123',status:'RESERVED',customerName:'Khách GU',pickupDate:'2026-10-21',pickupAt:'2026-10-21T07:00:00.000Z',...patch}) as RentalOrder;
const at=(hour:number,day='2026-10-21')=>new Date(`${day}T${String(hour-7).padStart(2,'0')}:00:00.000Z`);
test('Cảnh báo chỉ sau đúng giờ hẹn VN nếu đơn vẫn RESERVED',()=>{
 assert.equal(overduePickupNotice(order(),at(13)),null);
 assert.equal(overduePickupNotice(order(),at(14)),null); // đúng 14:00, chưa quá giờ
 assert.equal(overduePickupNotice(order(),new Date('2026-10-21T07:01:00Z'))?.orderId,'o1');
 for(const status of ['PICKED_UP','RETURNED','CANCELLED','VOIDED'] as const)assert.equal(overduePickupNotice(order({status}),at(15)),null);
});
test('Ưu tiên giờ hẹn gốc khi giờ lấy khác với giờ hẹn',()=>{
 const o=order({scheduledPickupAt:'2026-10-21T06:00:00.000Z',pickupAt:'2026-10-21T07:00:00.000Z'});
 assert.equal(overduePickupNotice(o,new Date('2026-10-21T06:30:00Z'))?.orderId,'o1');
});
test('Đơn cũ không có giờ chỉ nhắc sau ngày hẹn, không tự suy ra 00:00',()=>{
 const legacy=order({pickupAt:undefined,scheduledPickupAt:undefined});
 assert.equal(overduePickupNotice(legacy,at(22)),null);
 assert.equal(overduePickupNotice(legacy,at(8,'2026-10-22'))?.scheduledAt,null);
 assert.equal(overduePickupNotice(legacy,at(10,'2026-10-20')),null);
 assert.equal(overduePickupNotice(order({pickupAt:'2026-10-21',scheduledPickupAt:undefined}),at(10)),null);
});
test('Danh sách loại đơn đã giao, xếp theo giờ hẹn và không lộ thông tin điện thoại',()=>{
 const actual=overduePickupNotices([order({id:'later',pickupAt:'2026-10-21T08:00:00Z'}),order({id:'first',pickupAt:'2026-10-21T06:00:00Z'}),order({id:'out',status:'PICKED_UP'})],at(20));
 assert.deepEqual(actual.map(x=>x.orderId),['first','later']);
 assert.equal(Object.hasOwn(actual[0],'customerPhone'),false);
});
test('API kiểm tra tất cả RESERVED, UI có banner màu riêng và tìm đơn chính xác',()=>{
 const api=readFileSync('src/app/api/v5/return-risk/route.ts','utf8');
 const page=readFileSync('src/app/page.tsx','utf8');
 const css=readFileSync('src/app/globals.css','utf8');
 assert.match(api,/loadAll\('status','RESERVED'\)/);
 assert.match(api,/latePickups,checkedAt/);
 assert.match(page,/gu-late-pickup-banner/);
 assert.match(page,/setDismissedPickupSignature/);
 assert.match(page,/setQuery\(code\)/);
 assert.match(css,/\.gu-late-pickup-badge/);
});
test('Storage cấu hình từ biến server và có kiểm tra bucket sẵn có',()=>{
 const script=readFileSync('scripts/diagnose-storage.mjs','utf8');
 const packageJson=JSON.parse(readFileSync('package.json','utf8'));
 assert.match(script,/FIREBASE_STORAGE_BUCKET/);
 assert.match(script,/getMetadata/);
 assert.match(script,/if\(process\.argv\.includes\('--write-test'\)\)/);
 assert.match(script,/bucket\.getMetadata\(\)/);
 assert.ok(packageJson.scripts['diagnose:storage']);
});
