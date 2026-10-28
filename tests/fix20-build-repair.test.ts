import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {mkdtempSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const script=readFileSync('scripts/gu-fix20-source-guard.mjs','utf8');
const manifest=JSON.parse(readFileSync('scripts/gu-fix20-source-manifest.json','utf8'));
const read=(p:string)=>readFileSync(p,'utf8');

test('Fix20 source manifest matches the shipped source tree',()=>{
 assert.ok(manifest.files.length>70);
 assert.ok(manifest.files.includes('src/lib/local-media.ts'));
 for(const p of manifest.files)assert.ok(existsSync(p),p);
 assert.ok(!manifest.files.includes('src/app/api/auth/route.ts'));
 assert.ok(!manifest.files.includes('src/app/api/gu/[resource]/route.ts'));
 assert.ok(!manifest.files.includes('src/app/api/gu/[resource]/[id]/route.ts'));
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts.build,/gu-fix20-source-guard\.mjs --check/);
 assert.match(pkg.scripts['verify:release'],/gu-fix20-source-guard\.mjs --check/);
});

test('Fix20 source guard detects stale routes and preserves them in sibling backup',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'gu-fix20-source-test-'));
 try{
  mkdirSync(join(fixture,'scripts'),{recursive:true});
  mkdirSync(join(fixture,'tests'),{recursive:true});
  writeFileSync(join(fixture,'tests','keep.test.ts'),'export const ok=true;');
  mkdirSync(join(fixture,'src','app','api','auth'),{recursive:true});
  writeFileSync(join(fixture,'package.json'),'{}');
  writeFileSync(join(fixture,'scripts','gu-fix20-source-guard.mjs'),script);
  writeFileSync(join(fixture,'scripts','gu-fix20-source-manifest.json'),JSON.stringify({schema:1,files:['src/app/keep.ts'],tests:['tests/keep.test.ts'],scripts:['scripts/gu-fix20-source-guard.mjs']}));
  writeFileSync(join(fixture,'src','app','keep.ts'),'export const ok=true;');
  writeFileSync(join(fixture,'src','app','api','auth','route.ts'),'import argon2 from "argon2";');
  const check=spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs','--check'],{cwd:fixture,encoding:'utf8'});
  assert.equal(check.status,1);
  assert.match(check.stderr,/STALE: src\/app\/api\/auth\/route\.ts/);
  const prune=spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs','--prune'],{cwd:fixture,encoding:'utf8'});
  assert.equal(prune.status,0,prune.stderr);
  assert.ok(!existsSync(join(fixture,'src','app','api','auth','route.ts')));
  const match=/moved 1 stale source\/test\/script files to (.*)/.exec(prune.stdout);
  assert.ok(match,prune.stdout);
  const backup=match[1].trim();
  assert.ok(backup.startsWith(dirname(fixture)));
  assert.match(read(join(backup,'src','app','api','auth','route.ts')),/argon2/);
  assert.equal(spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs','--check'],{cwd:fixture}).status,0);
  rmSync(backup,{recursive:true,force:true});
 }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('Fix20 source guard refuses pruning when copied Fix20 source is missing',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'gu-fix20-incomplete-'));
 try{
  mkdirSync(join(fixture,'scripts'),{recursive:true});
  mkdirSync(join(fixture,'tests'),{recursive:true});
  writeFileSync(join(fixture,'tests','keep.test.ts'),'export const ok=true;');
  mkdirSync(join(fixture,'src','app','api','auth'),{recursive:true});
  writeFileSync(join(fixture,'package.json'),'{}');
  writeFileSync(join(fixture,'scripts','gu-fix20-source-guard.mjs'),script);
  writeFileSync(join(fixture,'scripts','gu-fix20-source-manifest.json'),JSON.stringify({schema:1,files:['src/app/missing.ts'],tests:['tests/keep.test.ts'],scripts:['scripts/gu-fix20-source-guard.mjs']}));
  const stale=join(fixture,'src','app','api','auth','route.ts');
  writeFileSync(stale,'import argon2 from "argon2";');
  const prune=spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs','--prune'],{cwd:fixture,encoding:'utf8'});
  assert.equal(prune.status,1);
  assert.ok(existsSync(stale));
 }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('Fix20 source guard blocks old workflows that could deploy Production',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'gu-fix20-workflows-'));
 try{
  mkdirSync(join(fixture,'scripts'),{recursive:true});
  mkdirSync(join(fixture,'tests'),{recursive:true});
  writeFileSync(join(fixture,'tests','keep.test.ts'),'export const ok=true;');
  mkdirSync(join(fixture,'src','app'),{recursive:true});
  mkdirSync(join(fixture,'.github','workflows'),{recursive:true});
  writeFileSync(join(fixture,'package.json'),'{}');
  writeFileSync(join(fixture,'scripts','gu-fix20-source-guard.mjs'),script);
  writeFileSync(join(fixture,'scripts','gu-fix20-source-manifest.json'),JSON.stringify({schema:1,files:['src/app/keep.ts'],tests:['tests/keep.test.ts'],scripts:['scripts/gu-fix20-source-guard.mjs']}));
  writeFileSync(join(fixture,'src','app','keep.ts'),'export const ok=true;');
  const legacy=join(fixture,'.github','workflows','deploy-old-production.yml');
  writeFileSync(legacy,'on: push\n');
  const check=spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs','--check'],{cwd:fixture,encoding:'utf8'});
  assert.equal(check.status,1);
  assert.match(check.stderr,/REVIEW WORKFLOW: \.github\/workflows\/deploy-old-production\.yml/);
  assert.ok(existsSync(legacy));
 }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('GU media filesystem operations are flagged as runtime-only for Turbopack',()=>{
 const media=read('src/lib/local-media.ts');
 for(const marker of ['mkdir(/* turbopackIgnore: true */','writeFile(/* turbopackIgnore: true */','readFile(/* turbopackIgnore: true */'])assert.ok(media.includes(marker),marker);
 assert.ok(media.includes("process.env.GU_UPLOAD_DIR||'/var/lib/gu/uploads'"));
 assert.ok(media.includes('const uploadFolder=dirname(target);'), 'use the validated target path for mkdir');
 assert.ok(!media.includes('join(base(),dir,uid)'), 'do not dynamically join the uploads root for mkdir');
});
