import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const components=['GuEvidenceHistory','GuExtras','GuSystem'];
test('all previously broken components declare use client before imports',()=>{
 for(const name of components){
  const source=readFileSync(`src/components/${name}.tsx`,'utf8');
  assert.match(source,/^'use client';\r?\nimport /,name);
 }
});
test('automatic client directive guard passes',()=>{
 const out=execFileSync(process.execPath,['scripts/check-client-directives.mjs'],{encoding:'utf8'});
 assert.match(out,/CHECK OK/);
});
