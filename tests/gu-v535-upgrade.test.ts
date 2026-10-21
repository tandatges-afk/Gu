import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankVisualItems,validVisualSignature,visualDistance,type VisualSignature} from '../src/lib/visual-index.ts';
const read=(p:string)=>readFileSync(p,'utf8');
const sig=(v:number,hash='0000000000000000'):VisualSignature=>({version:1,features:Array(24).fill(v),hash});
test('dấu vân tay ảnh hợp lệ, chặn NaN và dữ liệu không đúng phiên bản',()=>{
 assert.equal(validVisualSignature(sig(0.25)),true);
 assert.equal(validVisualSignature({...sig(0.25),features:Array(24).fill(NaN)}),false);
 assert.equal(validVisualSignature({...sig(0.25),hash:'abc'}),false);
 assert.equal(validVisualSignature({...sig(0.25),version:2}),false);
});
test('ảnh tương tự xếp trên ảnh rất khác; ưu tiên màu và đường nét',()=>{
 const target=sig(.4);
 const docs=[{id:'x',signature:sig(.9,'ffffffffffffffff')},{id:'b',signature:sig(.4)},{id:'a',signature:sig(.46)}];
 assert.deepEqual(rankVisualItems(docs,target).map(x=>x.id),['b','a','x']);
 assert.equal(visualDistance(target,target),0);
 assert.ok(visualDistance(target,docs[0].signature)>visualDistance(target,docs[2].signature));
});
test('chỉ mục ảnh compact, backfill chỉ Admin, kiểm tra ảnh cùng sản phẩm',()=>{
 const route=read('src/app/api/v5/visual-catalog/route.ts');
 assert.match(route,/requireAdmin\(me\)/);assert.match(route,/validVisualSignature/);
 assert.match(route,/info\?\.imagePaths\?\.\[0\]!==entry\.imagePath/);
 assert.match(route,/take=150/);
 const finder=read('src/components/GuVisualFinder.tsx');assert.match(finder,/rankVisualCandidates/);
 assert.doesNotMatch(finder,/Promise\.all\(Array\.from\(\{length:6\}/);
});
test('tạo khách cùng transaction đơn và khóa SĐT, không gọi tạo khách trước',()=>{
 const route=read('src/app/api/v5/orders/route.ts');
 assert.match(route,/phoneIndex/);assert.match(route,/tx\.create\(resolvedCustomerRef/);
 assert.match(route,/tx\.create\(orderRef/);assert.match(route,/await db\(\)\.runTransaction/);
 const form=read('src/components/GuV5Booking.tsx');
 assert.match(form,/quickCustomer:\{name:name\.trim\(\),phone:digits\(phone\)\}/);
 assert.doesNotMatch(form,/api<Customer>\('customers',\{method:'POST'/);
});
test('payment idempotency, ledger and capture reuse same payment panel',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(route,/cashMovements'\)\.doc\(requestId\)/);
 assert.match(route,/const previously=await tx\.get\(movement\)/);
 assert.match(route,/Number\(b\.expectedTopup\)!==topup/);
 assert.match(route,/readVerifiedEvidence\(tx,String\(b\.paymentProofId\|\|''\)/);
 const capture=read('src/components/GuOrderCapture.tsx');
 const detail=read('src/components/GuV5Review.tsx');
 assert.match(capture,/GuOrderPaymentPanel/);assert.match(detail,/GuOrderPaymentPanel/);
});
test('lọc kho server trả đúng trang theo trạng thái và danh mục',()=>{
 const route=read('src/app/api/catalog/route.ts');
 assert.match(route,/requestedStatus/);assert.match(route,/requestedCategory/);
 assert.match(route,/inventoryMatches/);assert.match(route,/hasMore=idx<snap\.docs\.length-1/);
 const page=read('src/app/page.tsx');assert.match(page,/GuInventoryFilters/);
 assert.match(page,/inventoryLayout\.root/);
});
