import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
test('Ảnh chứng từ mới được upload authenticated, không dùng URL public',()=>{
 const route=read('src/app/api/v5/secure-photo/route.ts');
 const cloud=read('src/lib/cloudinary-secure.ts');
 assert.match(route,/uploadSecureCloudinary\(bytes,file.type,me.uid,id\)/);
 assert.match(route,/provider:'cloudinary'/);
 assert.match(cloud,/body.set\('type','authenticated'\)/);
 assert.match(cloud,/data.type!=='authenticated'/);
 assert.match(route,/NextResponse.json\(\{id\}/);
 assert.doesNotMatch(route,/NextResponse.json\(\{[^}]*secure_url/);
});
test('Xem ảnh Cloudinary qua proxy có phân quyền và no-store',()=>{
 const route=read('src/app/api/v5/secure-photo/route.ts'), cloud=read('src/lib/cloudinary-secure.ts');
 assert.match(route,/canReadEvidence\(me,order.data\(\)/);
 assert.match(route,/throw new ApiError\(403,'Bạn không có quyền xem/);
 assert.match(route,/downloadSecureCloudinary\(image\)/);
 assert.match(cloud,/expires_at:nowSeconds\+90/);
 assert.match(cloud,/type:'authenticated'/);
 assert.match(cloud,/redirect:'error'/);
 assert.match(route,/Cache-Control':'private,no-store/);
 assert.doesNotMatch(route,/NextResponse.redirect/);
});
test('Ảnh cũ Firebase vẫn có đường đọc, ảnh mới không cần bucket',()=>{
 const route=read('src/app/api/v5/secure-photo/route.ts');
 const env=read('.env.example');
 assert.match(route,/else if\(typeof info.path==='string'\)/);
 assert.match(route,/evidenceBucket\(\)\.file\(info.path\).download\(\)/);
 assert.match(env,/FIREBASE_STORAGE_BUCKET KHÔNG CẦN cho ảnh mới/);
});
test('Admin có thể thử Cloudinary mà không ghi dữ liệu khách',()=>{
 const health=read('src/app/api/v5/storage-health/route.ts');
 assert.match(health,/requireAdmin\(me\)/);
 assert.match(health,/uploadSecureCloudinary\(testPng/);
 assert.match(health,/deleteSecureCloudinary\(stored.publicId\)/);
 assert.doesNotMatch(health,/evidenceBucket\(\)/);
});
