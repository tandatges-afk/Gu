import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isInventoryCodeQuery,inventoryCodeNeedle,matchesInventoryCode} from '../src/lib/catalog-code-search.ts';
const read=(p:string)=>readFileSync(p,'utf8');

test('numeric-only partial code fragments preserve zeros and never produce invalid GU-00000',()=>{
 for(const term of ['0','00','00002','234','GU-00002','GU-00007','GU 00007'])assert.equal(isInventoryCodeQuery(term),true,term);
 assert.equal(inventoryCodeNeedle('00'),'00');
 assert.equal(matchesInventoryCode('GU-00002','00'),true);
 assert.equal(matchesInventoryCode('GU-00002','00002'),true);
 assert.equal(matchesInventoryCode('GU-00234','234'),true);
 assert.equal(matchesInventoryCode('GU-00007','GU-00007'),true);
 assert.equal(matchesInventoryCode('GU-00007','GU 00007'),true);
 assert.equal(matchesInventoryCode('GU-00007','2'),false);
 assert.equal(matchesInventoryCode('GU-00234','00007'),false);
 assert.equal(isInventoryCodeQuery(''),false);
 assert.equal(isInventoryCodeQuery('123456'),false);
 assert.equal(isInventoryCodeQuery('Áo xanh'),false);
});
test('catalog scans codes as strings, filters archived products and paginates from last scanned Firestore doc',()=>{
 const api=read('src/app/api/catalog/route.ts');
 assert.match(api,/isInventoryCodeQuery\(term\)/);
 assert.match(api,/matchesInventoryCode\(String\(entry.hangerCode\|\|''\),term\)/);
 assert.match(api,/codeQuery=codeQuery.startAfter/);
 assert.match(api,/inventoryMatches\(entry\)/);
 assert.match(api,/inventoryMatches\(doc.data\(\)\)/);
 assert.doesNotMatch(api,/formatHangerCode\(Number\(/);
});
test('dashboard counts exclude archived stock in one PostgreSQL aggregate',()=>{
 const api=read('src/app/api/bootstrap/route.ts');
 const counts=read('src/lib/pg-dashboard-counts.ts');
 assert.match(api,/getDashboardCounts\(\)/);
 assert.match(counts,/COALESCE\(data->>'archivedAt',''\)=''/);
 for(const status of ['AVAILABLE','LAUNDRY','RENTED','MISSING'])
  assert.ok(counts.includes("data->>'status'='"+status+"'"));
 assert.doesNotMatch(api,/archivedItems\.docs/);
});
test('editing inventory query clears stale global error; success clears the previous request error',()=>{
 const ui=read('src/app/page.tsx');
 assert.match(ui,/GuInventoryFilters/);
 const filters=read('src/components/GuInventoryFilters.tsx');
 assert.match(filters,/clearError\(\)/);
 assert.match(ui,/if\(!cancelled\)\{setCatalogData\(result\);setErr\(''\);\}/);
 assert.match(ui,/matchesInventoryCode\(i.hangerCode,query\)/);
});
