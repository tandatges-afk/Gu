import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyServerFailure} from '../src/lib/server-error-classifier.ts';
const read=(path:string)=>readFileSync(path,'utf8');

test('Admin resource page shows Cloudinary only and remains admin-only',()=>{
 const ui=read('src/components/GuSystem.tsx');const api=read('src/app/api/system/route.ts');
 assert.match(ui,/>Cloudinary</);assert.match(ui,/Credits/);
 assert.doesNotMatch(ui,/Firebase Firestore|Monitoring Viewer|Vercel \u00b7 Web\/API|Lưu ý về vận hành|gu-system-operations/);
 assert.doesNotMatch(api,/firestoreReport|monitoring.googleapis.com|db\(\)\.collection/);
 assert.match(api,/cloudinaryReport/);assert.match(api,/me.role!=='admin'/);
});
test('Finder and product form do not show unnecessary hints or undefined results',()=>{
 const home=read('src/app/page.tsx'),finder=read('src/components/GuVisualFinder.tsx');
 assert.doesNotMatch(home,/Chưa có góc chụp\. Admin cần thêm trước khi tạo lịch thuê\./);
 assert.doesNotMatch(finder,/Chụp trực tiếp hoặc chọn ảnh từ điện thoại\/máy tính\./);
 assert.doesNotMatch(home,/catalogData\?\.results.length\+'/);
 assert.match(home,/page==='inventory'\?filteredItems\.length/);
});
test('Firestore and Cloudinary operations remain intact despite removing Firestore usage panel',()=>{
 assert.match(read('src/app/api/items/route.ts'),/db\(\)\.collection\('items'\)/);
 assert.match(read('src/app/api/v5/orders/route.ts'),/db\(\)/);
 assert.match(read('src/app/api/uploads/route.ts'),/api.cloudinary.com/);
});
test('Known Firestore errors are explained safely and unknown ones retain incident id',()=>{
 assert.equal(classifyServerFailure({code:7})?.code,'GU_DB_PERMISSION');
 assert.equal(classifyServerFailure({code:8})?.code,'GU_DB_LIMIT');
 assert.equal(classifyServerFailure({code:9})?.code,'GU_DB_PRECONDITION');
 assert.equal(classifyServerFailure({code:14})?.status,503);
 assert.equal(classifyServerFailure({code:'UNAUTHENTICATED'})?.code,'GU_DB_AUTH');
 assert.equal(classifyServerFailure(new Error('UNKNOWN')),null);
 const server=read('src/lib/http.ts');assert.match(server,/incidentId/);assert.match(server,/console.error\('\[GU_SERVER_ERROR\]'/);
});
