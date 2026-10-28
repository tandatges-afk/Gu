import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const guard=readFileSync('scripts/gu-fix20-source-guard.mjs','utf8');

test('Fix20 guard checks and safely backs up stale tests and scripts as well as source',()=>{
 const root=mkdtempSync(join(tmpdir(),'gu-fix20-extended-'));
 let backup='';
 try{
  for(const d of ['src','tests','scripts'])mkdirSync(join(root,d),{recursive:true});
  writeFileSync(join(root,'package.json'),'{}');
  writeFileSync(join(root,'src','keep.ts'),'export const ok=true;');
  writeFileSync(join(root,'tests','keep.test.ts'),'export const ok=true;');
  writeFileSync(join(root,'scripts','gu-fix20-source-guard.mjs'),guard);
  writeFileSync(join(root,'scripts','gu-fix20-source-manifest.json'),JSON.stringify({schema:1,files:['src/keep.ts'],tests:['tests/keep.test.ts'],scripts:['scripts/gu-fix20-source-guard.mjs']}));
  writeFileSync(join(root,'tests','logic.test.ts'),'legacy stale test');
  writeFileSync(join(root,'scripts','old-deploy.mjs'),'throw Error("obsolete");');
  const run=(mode:string)=>spawnSync(process.execPath,['scripts/gu-fix20-source-guard.mjs',mode],{cwd:root,encoding:'utf8'});
  const first=run('--check');
  assert.equal(first.status,1,first.stderr);
  assert.match(first.stderr,/STALE: tests\/logic\.test\.ts/);
  assert.match(first.stderr,/STALE: scripts\/old-deploy\.mjs/);
  const prune=run('--prune');
  assert.equal(prune.status,0,prune.stderr);
  backup=/moved 2 stale source\/test\/script files to (.*)/.exec(prune.stdout)?.[1]?.trim()||'';
  assert.ok(backup,prune.stdout);
  assert.ok(existsSync(join(backup,'tests','logic.test.ts')));
  assert.ok(existsSync(join(backup,'scripts','old-deploy.mjs')));
  assert.ok(existsSync(join(root,'tests','keep.test.ts')));
  assert.equal(run('--check').status,0);
 }finally{
  if(backup)rmSync(backup,{recursive:true,force:true});
  rmSync(root,{recursive:true,force:true});
 }
});

test('Fix20 release manifest tracks tests and maintenance scripts',()=>{
 const m=JSON.parse(readFileSync('scripts/gu-fix20-source-manifest.json','utf8'));
 assert.ok(m.tests.includes('tests/fix20-source-manifest-extended.test.ts'));
 assert.ok(m.scripts.includes('scripts/gu-fix20-source-guard.mjs'));
 assert.ok(!m.tests.includes('tests/logic.test.ts'));
 assert.ok(!m.tests.includes('tests/operational.test.ts'));
});

test('Fix20 integrated branch triggers validation without production autodeploy',()=>{
 const flow=readFileSync('.github/workflows/deploy-main.yml','utf8');
 assert.match(flow,/gu-fix20-integrated-\*/);
 assert.match(flow,/pull_request:/);
 assert.match(flow,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.target == 'prod'/);
});
