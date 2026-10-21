import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyServerFailure} from '../src/lib/server-error-classifier.ts';
const system=readFileSync('src/components/GuSystem.tsx','utf8');
const api=readFileSync('src/app/api/system/route.ts','utf8');
const page=readFileSync('src/app/page.tsx','utf8');
const finder=readFileSync('src/components/GuVisualFinder.tsx','utf8');
test('admin system is Cloudinary only; no Monitoring or Firestore collection counts',()=>{
 assert.match(system,/Dung lượng & băng thông/);
 assert.doesNotMatch(system,/Firebase Firestore|Vercel · Web\/API|Lưu ý về vận hành|Monitoring/);
 assert.doesNotMatch(api,/monitoring\.googleapis|firestoreReport|collection\(name\)\.count|serverCredential/);
 assert.match(api,/cloudinaryReport/);
});
test('no redundant angles or search hints or undefined catalog pagination text',()=>{
 assert.doesNotMatch(page,/Chưa có góc chụp\. Admin cần thêm trước khi tạo lịch thuê/);
 assert.doesNotMatch(page,/catalogData\?\.results\.length\+'/);
 assert.match(page,/catalogData\?`\$\{catalogData\.results\?\.length \?\? 0\} kết quả`/);
 assert.doesNotMatch(finder,/Chụp trực tiếp hoặc chọn ảnh từ điện thoại/);
 assert.doesNotMatch(finder,/Chưa phải AI; cần xác nhận/);
});
test('recognized Firestore errors have safe actionable categories',()=>{
 assert.equal(classifyServerFailure({code:7})?.code,'GU_DB_PERMISSION');
 assert.equal(classifyServerFailure({code:'RESOURCE_EXHAUSTED'})?.status,503);
 assert.equal(classifyServerFailure({code:9})?.code,'GU_DB_PRECONDITION');
 assert.equal(classifyServerFailure(new TypeError('programming bug')),null);
});
