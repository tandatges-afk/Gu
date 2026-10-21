import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyStorageFailure} from '../src/lib/secure-storage-errors.ts';
const read=(file:string)=>readFileSync(file,'utf8');
test('404 ảnh không tồn tại không bị báo sai là bucket chưa tạo',()=>{
 assert.equal(classifyStorageFailure({code:404,message:'No such object'},'download')?.code,'GU_STORAGE_OBJECT_NOT_FOUND');
 assert.equal(classifyStorageFailure({statusCode:404},'metadata')?.code,'GU_STORAGE_BUCKET_NOT_FOUND');
 assert.equal(classifyStorageFailure({code:404},'upload')?.code,'GU_STORAGE_UPLOAD_NOT_FOUND');
 assert.equal(classifyStorageFailure({code:404,message:'The specified bucket does not exist'},'upload')?.code,'GU_STORAGE_BUCKET_NOT_FOUND');
 assert.equal(classifyStorageFailure({code:403,message:'Permission denied'},'upload')?.code,'GU_STORAGE_PERMISSION');
});
test('kiểm tra Storage thực sự trong Vercel chỉ cho Admin và không lộ ảnh riêng tư',()=>{
 const route=read('src/app/api/v5/storage-health/route.ts');
 const ui=read('src/components/GuSystem.tsx');
 assert.match(route,/requireAdmin\(me\)/g);
 assert.match(route,/bucket\.getMetadata\(\)/);
 assert.match(route,/randomUUID\(\)/);
 assert.match(route,/object\.save\(/);
 assert.match(route,/object\.delete\(/);
 assert.doesNotMatch(route,/makePublic|signedUrl|download\(/);
 assert.match(ui,/Kiểm tra bucket/);
 assert.match(ui,/Thử ghi \/ xóa/);
});
test('ẩn hint trùng lặp nhưng giữ nhãn nhập, gói giá và cảnh báo nghiệp vụ',()=>{
 const booking=read('src/components/GuV5Booking.tsx');
 const home=read('src/app/page.tsx');
 const finder=read('src/components/GuVisualFinder.tsx');
 assert.doesNotMatch(booking,/Tìm máy ảnh theo tên, mã hoặc serial/);
 assert.match(booking,/aria-label=\{rentalGroup/);
 assert.doesNotMatch(booking,/gu-v5-stages/);
 assert.match(booking,/Chọn gói thuê máy ảnh/);
 assert.match(booking,/Khách cần thanh toán ngay/);
 assert.doesNotMatch(home,/gu-calendar-search-note/);
 assert.doesNotMatch(finder,/Chọn đúng danh mục sẽ giảm nhầm lẫn/);
 assert.match(finder,/availabilityError/);
});
