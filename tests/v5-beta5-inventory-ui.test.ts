import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categorySelectOptions,DEFAULT_PRODUCT_SIZE,isNonLaundryCategory,launderingForCategory} from '../src/lib/product-policies.ts';
const src=(name:string)=>readFileSync(name,'utf8');
test('only accessory and camera are built-in; admin-created categories retained',()=>{
 assert.deepEqual(categorySelectOptions([]),['Phụ kiện','Máy ảnh']);
 assert.deepEqual(categorySelectOptions(['Áo dài','Váy','Vest','Trang phục','Đầm dạ tiệc']),['Phụ kiện','Máy ảnh','Đầm dạ tiệc']);
 assert.ok(categorySelectOptions(['Đầm dạ tiệc'],'Áo dài').includes('Áo dài')); // edit historical item without deleting data
});
test('no size required for new or edited products, historical size stays compatible',()=>{
 assert.equal(DEFAULT_PRODUCT_SIZE,'Một size');
 for(const file of ['src/app/api/items/route.ts','src/app/api/items/[id]/route.ts']){
  const code=src(file);assert.match(code,/const size=DEFAULT_PRODUCT_SIZE/);
  assert.doesNotMatch(code,/assertText\(b\.size/);
 }
 assert.doesNotMatch(src('src/app/page.tsx'),/<Field label="Size">/);
});
test('accessories and cameras never enter laundry; clothing still may',()=>{
 for(const name of ['Phụ kiện','Máy ảnh']){
  assert.equal(isNonLaundryCategory(name),true);
  assert.equal(launderingForCategory(name,true),false);
 }
 assert.equal(launderingForCategory('Đầm dạ tiệc',true),true);
 assert.equal(launderingForCategory('Đầm dạ tiệc',false),false);
 for(const file of ['src/app/api/items/route.ts','src/app/api/items/[id]/route.ts'])assert.match(src(file),/launderingForCategory\(category/);
 assert.match(src('src/app/page.tsx'),/!isNonLaundryCategory\(newItem\.category\)/);
});
test('photo angle labels are created individually by admin only, no hardcoded defaults',()=>{
 const page=src('src/app/page.tsx');
 assert.match(page,/Thêm góc chụp/);assert.match(page,/setAngleDraft/);
 assert.doesNotMatch(page,/inspectionAngles:\['Toàn thân trước'/);
 assert.match(src('src/lib/inspection-proof.ts'),/DEFAULT_ANGLES:string\[\]=\[\]/);
 const order=src('src/app/api/v5/orders/route.ts');
 assert.match(order,/Admin cần thêm góc ảnh giao\/nhận/);
 assert.match(src('src/app/api/v5/orders/\[id\]/route.ts'.replaceAll('\\','')),/Admin phải cấu hình góc chụp/);
});
test('unknown server failures have a diagnostic id, validation errors stay 400',()=>{
 const code=src('src/lib/http.ts');
 assert.match(code,/GU_SERVER_ERROR/);
 assert.match(code,/Không được trùng góc/);
});
