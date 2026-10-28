import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const workflow=readFileSync(join(root,'.github/workflows/deploy-main.yml'),'utf8');
const installer=readFileSync(join(root,'CAI-FIX20-VA-KIEM-TRA.ps1'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
test('Auto Production only runs for main push or emergency main dispatch after opt-in',()=>{
 assert.match(workflow,/if: github\.ref == 'refs\/heads\/main' && vars\.GU_V5_PRODUCTION_DEPLOY == 'enabled'/);
 assert.match(workflow,/github\.event_name == 'push'/);
 assert.match(workflow,/github\.event_name == 'workflow_dispatch' && inputs\.target == 'prod'/);
 assert.match(workflow,/Reject superseded commits/);
 assert.match(workflow,/vars\.GU_V5_PRODUCTION_DEPLOY == 'enabled'/);
 assert.match(workflow,/environment: gu-v5-production/);
 assert.match(workflow,/npm run test:vps/);
});
test('Rev6 installer uses isolated worktree with local source integrity and no automatic push',()=>{
 assert.match(installer,/worktree','add'/);
 assert.match(installer,/gu-fix20-package-check\.mjs/);
 assert.match(installer,/while \(\(Test-Path -LiteralPath \$folder\)/);
 assert.match(installer,/robocopy \$source \$folder \/E/);
 assert.doesNotMatch(installer, /Invoke-Checked git @\('push'/);
 assert.match(installer,/Do not overwrite or force push/);
});
test('Rev6 verify:release refuses modified/incomplete source archive',()=>{
 assert.match(pkg.scripts['verify:release'],/gu-fix20-package-check\.mjs/);
 assert.match(pkg.scripts['source:check'],/source-guard/);
});
