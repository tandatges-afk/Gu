import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileGuQuery,pgFieldSql} from '../src/lib/pg-query-compiler.ts';
const base={name:'items',conditions:[],ordering:[],bounds:{}};
test('fixed JSONB expression enables btree expression indexes and binds field values',()=>{
 const q=compileGuQuery({...base,conditions:[{field:'status',op:'==',value:"RENTED' OR true--"}],ordering:[{field:'name',dir:'asc'}],cap:30});
 assert.match(q.sql,/\(data->>'status'\) = \$2/);
 assert.match(q.sql,/ORDER BY \(data->>'name'\) ASC NULLS LAST, id ASC/);
 assert.equal(q.params[1],"RENTED' OR true--");
 assert.ok(!q.sql.includes("OR true--"));
 assert.equal(q.params.at(-1),30);
});
test('rejects untrusted JSONB field names',()=>{
 assert.throws(()=>pgFieldSql("name');DROP TABLE gu_documents;--"),/Invalid query key/);
 assert.throws(()=>pgFieldSql('a..b'),/Invalid query key/);
 assert.equal(pgFieldSql('customer.name'),"(data #>> '{customer,name}')");
});
test('Firestore count is a SQL aggregation, no payload read',()=>{
 const q=compileGuQuery({...base,name:'orders',conditions:[{field:'status',op:'in',value:['RESERVED','PICKED_UP']}]},'count');
 assert.match(q.sql,/SELECT COUNT\(\*\)::integer AS count/);
 assert.doesNotMatch(q.sql,/SELECT id,data/);
 assert.deepEqual(q.params,['orders',['RESERVED','PICKED_UP']]);
});
test('startAfter a snapshot with same product name uses id tiebreaker',()=>{
 const q=compileGuQuery({...base,ordering:[{field:'name',dir:'asc'}],after:{values:['Ao dai'],id:'id001'},cap:100});
 assert.match(q.sql,/\(data->>'name'\).*?OR/);
 assert.ok(q.sql.includes("id > $"));
 assert.equal(q.params.filter(x=>x==='Ao dai').length,2);
 assert.equal(q.params.at(-1),100);
});
test('two-column visual pagination respects the explicit document ID cursor',()=>{
 const q=compileGuQuery({...base,ordering:[{field:'name',dir:'asc'},{field:'__name__',dir:'asc'}],after:{values:['A','id007'],id:'id007'}});
 assert.ok(q.sql.includes("id > $"));
 assert.equal(q.params.includes('id007'),true);
});
test('plain startAfter(value) does not duplicate equal names with missing ID',()=>{
 const q=compileGuQuery({...base,ordering:[{field:'name',dir:'asc'}],after:{values:['Ao dai'],id:''}});
 assert.match(q.sql, /\(data->>'name'\) ASC/);
 assert.ok(!q.sql.includes("id > $"));
});
test('array contains searches by JSONB GIN-compatible expression',()=>{
 const q=compileGuQuery({...base,conditions:[{field:'nameSearchBigrams',op:'array-contains',value:'ao'}],cap:20});
 assert.match(q.sql,/\(data->'nameSearchBigrams'\) @> \$2::jsonb/);
 assert.equal(q.params[1],'["ao"]');
});
test('count with limit preserves cap',()=>{
 const q=compileGuQuery({...base,cap:20},'count');
 assert.match(q.sql,/LEAST\(count, \$2::integer\)/);
 assert.equal(q.params[1],20);
});
test('staging guard forbids pointing V5 at GU 6.1 production database',()=>{
 const env={...process.env,DATABASE_URL:'postgresql://gu_app:secret@127.0.0.1:5432/gu_db',APP_URL:'https://v5.guthuedo.io.vn',GU_UPLOAD_DIR:'/var/lib/gu-v546/uploads',GU_SESSION_SECRET:'x'.repeat(64)};
 const res=spawnSync(process.execPath,['scripts/check-staging-env.mjs'],{encoding:'utf8',env});
 assert.notEqual(res.status,0);assert.match(res.stderr,/gu_v546_stage/);
});