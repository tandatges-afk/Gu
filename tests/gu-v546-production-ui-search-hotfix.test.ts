import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSubstringCatalogQuery,VN_SEARCH_FROM,VN_SEARCH_TO} from '../src/lib/pg-catalog-search.ts';
const read=(path:string)=>readFileSync(path,'utf8');
test('Substring search is parameterized and preserves accent folding including đ',()=>{
 const query=buildSubstringCatalogQuery({kind:'customers',term:'Đạt',take:40});
 assert.match(query.sql,/translate\(lower\(/);
 assert.match(query.sql,/LIKE \$4/);
 assert.ok(VN_SEARCH_FROM.includes('đ'));
 assert.equal(VN_SEARCH_FROM.length,VN_SEARCH_TO.length);
 assert.equal(query.params[3],'%dat%');
 assert.ok(!query.sql.includes('Đạt'));
});
test('Any part of a customer phone works, not only a prefix',()=>{
 const query=buildSubstringCatalogQuery({kind:'customers',term:'6789',take:30,afterId:'abc123'});
 assert.ok(query.sql.includes('regexp_replace'));
 assert.equal(query.params[4],'%6789%');
 assert.match(query.sql,/id > \$6/);
});
test('Inventory name 123 is not forced into a product code-only search',()=>{
 const query=buildSubstringCatalogQuery({kind:'items',term:'123',take:30});
 assert.match(query.sql,/concat_ws/);
 assert.match(query.sql,/hangerCode/);
 assert.deepEqual(query.params.slice(3,5),['%123%','%123%']);
});
test('Search isolates camera category and remains SQL-filtered for page limits',()=>{
 const query=buildSubstringCatalogQuery({kind:'items',term:'áo',take:40,status:'AVAILABLE',category:'Trang phục',rentalGroup:'CLOTHING'});
 assert.match(query.sql,/data->>'status'/);
 assert.match(query.sql,/data->>'category'/);
 assert.match(query.sql,/NOT \(coalesce/);
 assert.equal(query.params.at(-1),41);
});
test('Debt queries respect PG 10000 cap and use migration-aware fallback',()=>{
 const source=read('src/app/api/debts/route.ts');
 assert.doesNotMatch(source,/\.limit\(10001\)/);
 assert.match(source,/\.limit\(10000\)/);
 assert.match(source,/buildDebtSummary\(scan.rows/);
});
test('Product images accept VPS URLs and finder receives catalog categories',()=>{
 const extras=read('src/components/GuExtras.tsx');
 assert.match(extras,/url\.startsWith\('\/api\/local-media\/products\/'\)/);
 const page=read('src/app/page.tsx');
 assert.match(page,/availableCategories=\{/);
 assert.match(page,/\.\.\.items\.map\(i=>i\.category\)/);
});
test('Calendar contains compound date field with explicit width override',()=>{
 const css=read('src/app/globals.css');
 assert.match(css,/\.gu-calendar-date-actions>\.gu-vn-date-only/);
});
