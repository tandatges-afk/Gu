import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_BULK_ITEMS,validateBulkNames} from '../src/lib/bulk-inventory-rules.ts';
const src=(p:string)=>readFileSync(p,'utf8');

test('Bulk: detects accents, case, punctuation and repeated names in the same batch',()=>{
 assert.deepEqual(validateBulkNames(['Áo dài xanh','ao dai XANH','Đầm xanh']),[{row:1,code:'DUPLICATE',message:'Trùng tên với dòng 1.'}]);
 assert.equal(validateBulkNames(['Áo-dài xanh'],['áo dài xanh'])[0].code,'EXISTING');
 assert.equal(validateBulkNames(['Đầm đen','Váy đỏ']).length,0);
 assert.equal(MAX_BULK_ITEMS,100);
});
test('Bulk: enforces atomic transaction, global name index, migration and idempotent retry',()=>{
 const api=src('src/app/api/items/bulk/route.ts');
 for(const key of ['productNameIndex','PRODUCT_NAME_INDEX_MIGRATION','runTransaction','inventoryCounters','bulkInventoryRequests','requestId','signature','tx.create(nameRefs[i]','tx.create(p.ref','auditInTransaction'])assert.ok(api.includes(key),key);
 assert.match(api,/migration\.data\(\)\?\.completed!==true/);
 assert.match(api,/checks\.forEach/);
 assert.match(api,/nextHangerSequence/);
 assert.match(api,/validProductImageUrl/);
 assert.match(api,/staffUser\(req\)/);
 assert.doesNotMatch(api,/db\(\)\.collection\('items'\)\.add\(/);
});
test('Bulk: one row per item, image uploader and dedicated inventory tab',()=>{
 const page=src('src/app/page.tsx'),ui=src('src/components/GuBulkInventory.tsx');
 assert.match(page,/inventoryTab==='bulk'/);
 assert.match(page,/Thêm nhiều sản phẩm/);
 for(const x of ['ImageUploader','Thêm dòng','Lưu ${rows.length} sản phẩm','inspectionAngles','replacementValue','cameraSerial','check','save'])assert.ok(ui.includes(x),x);
});
test('Deploy: workflow copies .github to VPS because release tests require workflow source',()=>{
 const wf=src('.github/workflows/deploy-main.yml');
 const matches=[...wf.matchAll(/rsync -az --delete[^\n]*/g)].map(x=>x[0]);
 assert.equal(matches.length,2);
 for(const call of matches){assert.doesNotMatch(call,/--exclude='\.github\//);assert.match(call,/--exclude='\.git\//);}
 assert.match(wf,/github\.ref == 'refs\/heads\/main'/);
});

test('GU Rev7.6: compact bulk entry keeps mandatory fields visible and removes duplicated inventory actions',()=>{
 const page=src('src/app/page.tsx');
 const ui=src('src/components/GuBulkInventory.tsx');
 const stylesheet=src('src/app/gu-redesign.css');
 const moduleCss=src('src/components/GuBulkInventory.module.css');
 const layout=src('src/app/layout.tsx');
 assert.match(page,/gu-inventory-tabs/);
 assert.match(page,/setInventoryTab\('bulk'\)/);
 assert.match(ui,/Nhân bản thiết lập/);
 assert.match(ui,/Mặt trước, Mặt sau/);
 assert.match(ui,/readyCount/);
 assert.match(ui,/isCameraCategory\(r.category\)/);
 assert.match(ui,/anglesAreReady/);
 assert.match(ui,/validateBulkNames/);
 assert.match(ui,/action:'check'/);
 assert.match(ui,/action:'save'/);
 assert.match(ui,/onSaved/);
 assert.match(moduleCss,/\.fields\{/);
 assert.match(moduleCss,/@media\(max-width:760px\)/);
 assert.match(layout,/gu-redesign\.css/);
 for(const key of ['.sidebar','.topbar','.content','.page-intro','.metric','.panel','.modal','.gu-inventory-tabs','@media(max-width:620px)'])assert.ok(stylesheet.includes(key),key);
});
