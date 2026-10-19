import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedAngles} from '../src/lib/inspection-proof.ts';

const orderRoute=readFileSync('src/app/api/v5/orders/route.ts','utf8');

test('v5 order snapshots every product as a validated Record<string,string[]>',()=>{
 assert.match(orderRoute,/const photoTemplates:Record<string,string\[\]>=\{\}/);
 assert.match(orderRoute,/photoTemplates\[item\.id\]=normalizedAngles\(item\.inspectionAngles\)/);
 assert.doesNotMatch(orderRoute,/photoTemplates=Object\.fromEntries\(items\.map\(i=>\[i\.id,i\.inspectionAngles\]\)\)/);
 assert.deepEqual(normalizedAngles([' Cổ áo ','Tay áo']),['Cổ áo','Tay áo']);
});

test('missing or invalid angle lists fail instead of persisting undefined',()=>{
 for(const invalid of [undefined,[],[''],['Cổ áo','Cổ áo'],[null]]){
  assert.throws(()=>normalizedAngles(invalid));
 }
 assert.match(orderRoute,/catch\{throw new ApiError\(409/);
});
