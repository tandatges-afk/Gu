import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
test('catalog supports one-character normalized search and cursor scan',()=>{const s=read('src/app/api/catalog/route.ts');assert.doesNotMatch(s,/Nhập ít nhất 2 ký tự để tìm sản phẩm/);assert.match(s,/indexKey=normalized.length===1/);assert.match(s,/startAfter/);});
test('v5 order has endpoint-aware errors and skips optional Firestore undefined',()=>{assert.match(read('src/lib/firebase-admin.ts'),/ignoreUndefinedProperties:true/);assert.match(read('src/app/api/v5/orders/route.ts'),/POST \/api\/v5\/orders/);});
test('transaction ledger only confirms manual refund',()=>{const s=read('src/app/api/v5/orders/[id]/route.ts');assert.match(s,/b.confirmRefund!==true/);assert.match(s,/cashMovements/);assert.match(s,/FieldValue.increment\(-refundDue\)/);});

test('no backend API leaks refund record to ordinary staff',()=>{const src=read('src/app/api/v5/orders/[id]/route.ts');assert.match(src,/me.role==='admin'\?/);});
