import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemsBelongToGroup,orderGroup,productGroup} from '../src/lib/order-group.ts';
import {isCameraCategory,CAMERA_TIERS,cameraBasePrice,chosenCameraPackageSnapshot} from '../src/lib/camera-rental.ts';
const code=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('máy ảnh / quần áo / phụ kiện được phân loại thành hai đơn riêng',()=>{
 assert.equal(productGroup('Máy ảnh'),'CAMERA');
 assert.equal(productGroup('Canon camera'),'CAMERA');
 assert.equal(productGroup('Áo dài'),'CLOTHING');
 assert.equal(productGroup('Phụ kiện'),'CLOTHING');
 assert.equal(productGroup('Phụ kiện máy ảnh'),'CLOTHING');
 assert.equal(isCameraCategory('Phụ kiện máy ảnh'),false);
 assert.equal(itemsBelongToGroup(['Áo dài','Phụ kiện'],'CLOTHING'),true);
 assert.equal(itemsBelongToGroup(['Máy ảnh','Canon camera'],'CAMERA'),true);
 assert.equal(itemsBelongToGroup(['Máy ảnh','Áo dài'],'CAMERA'),false);
 assert.equal(itemsBelongToGroup(['Máy ảnh','Áo dài'],'CLOTHING'),false);
 assert.equal(itemsBelongToGroup([],'CLOTHING'),false);
});
test('đơn cũ hỗn hợp không đổi lịch sử / không bị phân loại nhầm',()=>{
 assert.equal(orderGroup({lines:[{category:'Máy ảnh'},{category:'Áo dài'}]}),'LEGACY_MIXED');
 assert.equal(orderGroup({lines:[{category:'Máy ảnh'}]}),'CAMERA');
 assert.equal(orderGroup({lines:[{category:'Phụ kiện'},{category:'Áo dài'}]}),'CLOTHING');
 assert.equal(orderGroup({lines:[{category:'Máy ảnh'}],rentalGroup:'CLOTHING'}),'CAMERA');
});
test('camera 3/6/24/48h không thay đổi giá hợp đồng; trang phục thuê 24h riêng',()=>{
 assert.deepEqual([...CAMERA_TIERS],[3,6,24,48]);
 const start='2026-10-21T08:00:00Z';
 const three='2026-10-21T11:00:00Z';
 assert.equal(chosenCameraPackageSnapshot('Canon EOS R50',start,three,3).cameraPackageBasePrice,cameraBasePrice('Canon EOS R50',3));
 assert.throws(()=>chosenCameraPackageSnapshot('Canon EOS R50',start,'2026-10-21T12:00:00Z',3));
 const booking=code('src/components/GuV5Booking.tsx');
 assert.match(booking,/initialTimes\(/);
 assert.match(booking,/next\.setUTCDate\(next\.getUTCDate\(\)\+1\)/);
 assert.match(booking,/returnAt=useMemo\(\(\)=>rentalHours\?addPackageHours\(pickupAt,rentalHours\)/);
 assert.match(booking,/productGroup\(i\.category\)===rentalGroup/);
});
test('API bảo vệ phân nhóm ngay cả khi client gửi dữ liệu khác loại',()=>{
 const creation=code('src/app/api/v5/orders/route.ts');
 const modification=code('src/app/api/v5/orders/[id]/route.ts');
 assert.match(creation,/itemsBelongToGroup\(items\.map\(i=>i\.category\),group\)/);
 assert.match(creation,/rentalGroup:group/);
 assert.match(modification,/itemsBelongToGroup\(snaps\.map\(s=>String\(s\.data\(\)\?\.category\|\|''\)\),existingGroup\)/);
 assert.match(modification,/LEGACY_MIXED/);
});
test('đơn chung, lịch trang phục/phụ kiện và lịch máy ảnh tách riêng',()=>{
 const page=code('src/app/page.tsx');
 const catalog=code('src/app/api/catalog/route.ts');
 assert.match(page,/id:'camera-calendar',label:'Lịch máy ảnh'/);
 assert.match(page,/id:'orders',label:'Đơn thuê'/);
 assert.doesNotMatch(page,/id:'camera-orders'/);
 assert.match(page,/kind==='orders'\?'&rentalGroup=ALL'/);
 assert.match(page,/const calendarFilteredItems=calendarSearchPool\.filter\(i=>productGroup\(i\.category\)/);
 assert.match(page,/rentalGroup='\+\(page==='camera-calendar'\?'CAMERA':'CLOTHING'\)/);
 assert.match(catalog,/kind==='orders'&&requestedRentalGroup!=='ALL'/);
 assert.match(catalog,/collection=collection\.startAfter\(scan\.docs\[scan\.docs\.length-1\]\)/);
});
