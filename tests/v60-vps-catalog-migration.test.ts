import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(s:string)=>readFileSync(s,'utf8');

test('inventory/orders/customers are fully cursor-paged before filtering',()=>{
 const page=read('src/app/page.tsx');
 assert.match(page,/while\(cursor\&\&!cancelled\)/);
 assert.match(page,/setCatalogData\(\{kind,results:all,cursor:null,hasMore:false\}\)/);
 assert.match(page,/filteredItems\.slice\(\(catalogPage-1\)\*50/);
 assert.match(page,/filteredOrders\.slice\(\(catalogPage-1\)\*50/);
 assert.match(page,/filteredCustomers\.slice\(\(catalogPage-1\)\*50/);
 assert.doesNotMatch(page,/setCatalogCursor/);
});
test('VPS deployment has private runtime config and standalone build',()=>{
 assert.match(read('next.config.ts'),/output: 'standalone'/);
 assert.match(read('Dockerfile'),/CMD \["node", "server\.js"\]/);
 assert.match(read('deploy/vps/compose.yml'),/env_file:/);
 assert.match(read('deploy/vps/Caddyfile'),/reverse_proxy app:3000/);
 assert.doesNotMatch(read('.gitignore'),/\.env.example\n$/);
});
test('PostgreSQL is staging and preserves atomic overlapping-rental guard',()=>{
 const sql=read('deploy/migration/001_staging.sql');
 assert.match(sql,/EXCLUDE USING gist/);
 assert.match(sql,/status IN \('RESERVED','PICKED_UP'\)/);
 assert.match(read('deploy/migration/import-postgres.py'),/DOES NOT switch GU production APIs/);
});
