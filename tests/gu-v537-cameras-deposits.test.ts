import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chosenCameraPackageSnapshot,cameraQuoteForLine,rentalCharge} from '../src/lib/camera-rental.ts';
import {classifyStorageFailure} from '../src/lib/secure-storage-errors.ts';
const read=(p:string)=>readFileSync(p,'utf8');
const start='2026-10-20T07:00:00.000Z';
const at=(hours:number)=>new Date(Date.parse(start)+hours*3600000).toISOString();
test('Nhân viên chọn gói 3h/6h/24h/48h độc lập với suy luận thời gian',()=>{
 for(const tier of [3,6,24,48]){
  const snap=chosenCameraPackageSnapshot('Canon EOS R50',start,at(Math.min(tier,2)),tier);
  assert.equal(snap.cameraPackageHours,tier);
 }
 const three=chosenCameraPackageSnapshot('Canon EOS R50',start,at(2),3);
 const six=chosenCameraPackageSnapshot('Canon EOS R50',start,at(2),6);
 assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...three},start,at(2)),110000);
 assert.equal(rentalCharge({category:'Máy ảnh',cameraModel:'Canon EOS R50',...six},start,at(2)),130000);
 assert.equal(cameraQuoteForLine({category:'Máy ảnh',cameraModel:'Canon EOS R50',...three},start,at(3+1/60)).lateFee,10000);
 assert.throws(()=>chosenCameraPackageSnapshot('Canon EOS R50',start,at(4),3),/vượt gói/);
 assert.throws(()=>chosenCameraPackageSnapshot('Canon EOS R50',start,at(3),''),/Phải chọn gói/);
});
test('Tạo đơn máy ảnh có lựa chọn gói ở form và xác thực ngay tại server',()=>{
 const form=read('src/components/GuV5Booking.tsx');const route=read('src/app/api/v5/orders/route.ts');
 assert.match(form,/Chọn gói thuê máy ảnh/);
 assert.match(form,/setReturnAt\(addPackageHours\(pickupAt,hours\)\)/);
 assert.match(form,/cameraPackageHours:cameraItems\.length\?cameraPackageHours/);
 assert.match(route,/chosenCameraPackageSnapshot\(i\.cameraModel,pickupAt,returnAt,b\.cameraPackageHours\)/);
 assert.match(route,/rentalCharge\(\{\.\.\.i,\.\.\.cameraSnapshot\}/);
});
test('Đặt trước chỉ cần ảnh cọc, không yêu cầu phương thức/mã giao dịch',()=>{
 const form=read('src/components/GuV5Booking.tsx');const route=read('src/app/api/v5/orders/route.ts');
 assert.doesNotMatch(form,/Mã \/ nội dung giao dịch|<span>Phương thức<\/span>|paymentReference|paymentMethod|confirmPaid/);
 assert.match(form,/Chụp ảnh xác nhận tiền cọc/);
 assert.doesNotMatch(route,/b\.confirmPaid|b\.paymentMethod|b\.paymentReference/);
 assert.match(route,/method:'PHOTO_PROOF'/);
 assert.match(route,/readVerifiedEvidence\(tx,paymentProofId/);
});
test('Lỗi Storage hiển thị hướng khắc phục an toàn thay vì mã GU_SERVER_ERROR chung',()=>{
 const missing=classifyStorageFailure({code:404,message:'The specified bucket does not exist'});
 assert.equal(missing?.code,'GU_STORAGE_BUCKET_NOT_FOUND');
 assert.equal(classifyStorageFailure({statusCode:403,message:'storage.objects.create denied'})?.code,'GU_STORAGE_PERMISSION');
 assert.equal(classifyStorageFailure({code:'ETIMEDOUT'})?.code,'GU_STORAGE_UNAVAILABLE');
 assert.equal(classifyStorageFailure({statusCode:401})?.code,'GU_STORAGE_AUTH');
 assert.equal(classifyStorageFailure({code:'RANDOM_UNSUPPORTED'}),null);
 const route=read('src/app/api/v5/secure-photo/route.ts');
 assert.match(route,/uploadSecureCloudinary\(bytes/);
 assert.match(read('src/lib/cloudinary-secure.ts'),/type','authenticated'/); 
 assert.match(route,/purpose!=='reservation'&&purpose!=='deposit'/);
 assert.match(read('scripts/diagnose-storage.mjs'),/--write-test/);
});
