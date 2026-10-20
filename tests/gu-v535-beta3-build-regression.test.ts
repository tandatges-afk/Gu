import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(path,'utf8');
test('V5 create-order uses Firestore auto document IDs without undefined',()=>{
 const source=read('src/app/api/v5/orders/route.ts');
 assert.match(source,/legacyId\?customersCollection\.doc\(legacyId\):customersCollection\.doc\(\)/);
 assert.doesNotMatch(source,/\.doc\(quick\?\(legacyId\|\|undefined\)/);
 assert.match(source,/indexedCustomer\?\.exists&&!simpleId\(indexedCustomerId\)/);
});
test('Inventory filters, CSS layout, and image fingerprint are imported in page',()=>{
 const page=read('src/app/page.tsx');
 assert.match(page,/import\s*\{imageSignature\}\s*from\s*['"]@\/lib\/visual-image['"]/);
 assert.match(page,/import\s*\{GuInventoryFilters\}\s*from\s*['"]@\/components\/GuInventoryFilters['"]/);
 assert.match(page,/import\s+inventoryLayout\s+from\s*['"]@\/components\/GuInventoryTable\.module\.css['"]/);
 assert.match(page,/setQuery=\{\(v:string\)=>/);
});
