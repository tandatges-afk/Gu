import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
test('catalog uses a single indexed field rather than explicit document ID ordering',()=>{
 const code=read('src/app/api/catalog/route.ts');
 assert.match(code,/collection=collection\.orderBy\(field,descending\?'desc':'asc'\);/);
 assert.doesNotMatch(code,/\.orderBy\(FieldPath\.documentId\(\)\)/);
 assert.match(code,/startAfter\(lastDoc\)/);
 assert.match(code,/handleError\(e,'GET \/api\/catalog'\)/);
});
test('status based inventory pagination does not require a multi-field order',()=>{
 const code=read('src/app/api/stock-state/route.ts');
 assert.match(code,/\.where\('status','==',status\)\.orderBy\('status'\)/);
 assert.doesNotMatch(code,/\.orderBy\(FieldPath\.documentId/);
 assert.match(code,/\.startAfter\(lastDoc\)/);
});
test('index errors include endpoint for incident correlation without returning raw Firebase stack',()=>{
 const code=read('src/lib/http.ts');
 assert.match(code,/handleError\(err: unknown, endpoint\?: string\)/);
 assert.match(code,/endpoint\?\{endpoint\}/);
 assert.match(code,/GU_SERVER_ERROR/);
 assert.doesNotMatch(code,/JSON\.stringify\(err\)/);
});
test('button layout adapts to three client viewports and avoids global nav',()=>{
 const css=read('src/app/globals.css');
 assert.match(css,/GU v5 Beta 10: deterministic action spacing/);
 assert.match(css,/\.shell \.page-intro \.action-row/);
 assert.match(css,/\.shell \.modal \.gu-v5-photo-actions/);
 assert.match(css,/\.gu-v5-mobile\.gu-mobile-new \.gu-mobile-primary/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.gu-main-bottom-nav/);
});
