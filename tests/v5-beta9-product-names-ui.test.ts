import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {normalizeProductName,productNameIndexId} from '../src/lib/product-name.ts';
import {classifyServerFailure} from '../src/lib/server-error-classifier.ts';
const read=(p:string)=>readFileSync(p,'utf8');

test('Tên sản phẩm trùng bất kể dấu, hoa thường, khoảng trắng',()=>{
 const all=['Áo dài xanh','Ao dai xanh','áo dài xanh','ao dai xanh','  ÁO  DÀI  XANH  ','Áo-dài xanh'];
 assert.equal(new Set(all.map(normalizeProductName)).size,1);
 assert.equal(normalizeProductName('ĐẦM DẠ HỘI'),normalizeProductName('dam da hoi'));
 assert.equal(productNameIndexId('Áo dài xanh'),productNameIndexId('ao dai xanh'));
 assert.notEqual(productNameIndexId('Canon R50 #1'),productNameIndexId('Canon R50 #2'));
});
test('Tên sản phẩm được khóa giao dịch ở tạo/sửa, không chỉ kiểm tra giao diện',()=>{
 const create=read('src/app/api/items/route.ts'),edit=read('src/app/api/items/[id]/route.ts');
 assert.match(create,/productNameIndex/);assert.match(create,/tx\.create\(nameRef/);
 assert.match(create,/migration\.data\(\)\?\.completed/);
 assert.match(edit,/tx\.create\(nextNameRef/);assert.match(edit,/tx\.delete\(oldNameRef\)/);
 assert.match(edit,/owners\.some\(/);
});
test('Dữ liệu cũ được rà soát, không tự đổi tên khi migration',()=>{
 const migration=read('scripts/migrate-product-names.mjs');
 assert.match(migration,/DUPLICATE/);assert.match(migration,/--execute/);assert.match(migration,/--confirm=/);
 assert.doesNotMatch(migration,/update\(\{name:/);
});
test('FAILED_PRECONDITION không tự suy luận là thiếu index',()=>{
 assert.equal(classifyServerFailure({code:9,message:'The query requires an index'})?.code,'GU_DB_INDEX_REQUIRED');
 assert.equal(classifyServerFailure({code:9,message:'Transaction reads must be before writes'})?.code,'GU_DB_TRANSACTION');
 assert.equal(classifyServerFailure({code:9,message:'precondition unknown'})?.code,'GU_DB_PRECONDITION');
});
test('Admin và staff PC menu có nhóm vai trò, mobile có CSS độc lập',()=>{
 const page=read('src/app/page.tsx'),mobile=read('src/app/mobile/page.tsx'),css=read('src/app/globals.css');
 assert.match(page,/ĐƠN HÀNG/);assert.match(page,/QUẢN TRỊ/);
 assert.match(page,/normalizeProductName\(i\.name\)/);
 assert.match(mobile,/gu-staff-bottom-nav/);
 assert.match(css,/@media\(min-width:851px\)/);assert.match(css,/gu-main-bottom-nav,\.gu-staff-bottom-nav\{display:none!important\}/);
});
