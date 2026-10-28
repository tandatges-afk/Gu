/**
 * Verify the Fix20 source set. Copying with robocopy /E preserves obsolete API routes,
 * which Next.js still builds. `--prune` moves only outdated source CODE to a sibling
 * backup folder; it never touches .git, env files, uploads, or database backups.
 * No dependencies required: node scripts/gu-fix20-source-guard.mjs --check|--prune
 */
import {existsSync, readdirSync, readFileSync, mkdirSync, renameSync, statSync} from 'node:fs';
import {join, relative, resolve, dirname, basename, extname, sep} from 'node:path';
import {randomBytes} from 'node:crypto';

const root=process.cwd();
const manifestPath=join(root,'scripts','gu-fix20-source-manifest.json');
const mode=process.argv[2]??'--check';
if(!['--check','--prune'].includes(mode)){
 console.error('Usage: node scripts/gu-fix20-source-guard.mjs --check|--prune');
 process.exit(2);
}
if(!existsSync(join(root,'package.json'))||!existsSync(manifestPath)){
 console.error('GU SOURCE CHECK FAILED: run in repository root after copying the FULL Fix20 ZIP.');
 process.exit(2);
}
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(manifest.schema!==1||!Array.isArray(manifest.files)||!manifest.files.length){
 console.error('GU SOURCE CHECK FAILED: invalid manifest.');process.exit(2);
}
const codeExt=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const trackedGroups=[
  {label:'source',root:'src',allow:codeExt,paths:manifest.files,required:true},
  {label:'tests',root:'tests',allow:new Set(['.ts','.tsx','.js','.mjs']),paths:manifest.tests,required:true},
  {label:'scripts',root:'scripts',allow:new Set(['.js','.mjs','.cjs']),paths:manifest.scripts,required:true}
];
for(const group of trackedGroups){
 if(!Array.isArray(group.paths)||group.paths.length===0){
  console.error('GU SOURCE CHECK FAILED: missing '+group.label+' release manifest.');
  process.exit(2);
 }
 if(group.paths.some(p=>typeof p!=='string'||!p.startsWith(group.root+'/')||p.split('/').some(part=>['..','.',''].includes(part))||p.includes('\\')||!group.allow.has(extname(p)))){
  console.error('GU SOURCE CHECK FAILED: unsafe '+group.label+' manifest paths.');
  process.exit(2);
 }
 if(new Set(group.paths).size!==group.paths.length){
  console.error('GU SOURCE CHECK FAILED: duplicate '+group.label+' manifest paths.');
  process.exit(2);
 }
}
const expected=new Set(trackedGroups.flatMap(g=>g.paths));
if(manifest.files.some(p=>typeof p!=='string'||!p.startsWith('src/')||p.split('/').some(part=>part==='..'||part==='.'||part==='')||p.includes('\\')||!codeExt.has(extname(p)))){
 console.error('GU SOURCE CHECK FAILED: unsafe manifest path.');process.exit(2);
}
function scan(dir){
 if(!existsSync(dir))return [];
 let result=[];
 for(const e of readdirSync(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())continue;
  const full=join(dir,e.name);
  if(e.isDirectory())result.push(...scan(full));
  else if(e.isFile()&&codeExt.has(extname(e.name)))result.push(relative(root,full).split(sep).join('/'));
 }
 return result;
}
// Old GitHub workflows can auto-deploy on push. Never prune them automatically.
const workflows=join(root,'.github','workflows');
if(existsSync(workflows)){
 const oldWorkflows=readdirSync(workflows,{withFileTypes:true})
  .filter(e=>e.isFile()&&/\.ya?ml$/i.test(e.name)&&e.name!=='deploy-main.yml')
  .map(e=>e.name);
 if(oldWorkflows.length){
  console.error('GU SOURCE CHECK FAILED: old GitHub Actions workflows found (may auto-deploy Production):');
  for(const name of oldWorkflows)console.error('  REVIEW WORKFLOW: .github/workflows/'+name);
  console.error('Review and back up these workflows OUTSIDE the repo manually before commit/push. This tool will not remove them.');
  process.exit(1);
 }
}
const found=trackedGroups.flatMap(group=>scan(join(root,group.root)));
const missing=[...expected].filter(p=>!found.includes(p)).sort();
const extra=found.filter(p=>!expected.has(p)).sort();
if(missing.length){
 console.error(`GU SOURCE CHECK FAILED: missing ${missing.length} expected Fix20 source/test/script files.`);
 for(const p of missing.slice(0,50))console.error('  MISSING:',p);
 console.error('Re-extract the FULL Fix20 ZIP into a clean worktree; pruning is disabled until expected files exist.');
 process.exit(1);
}
if(!extra.length){
 console.log(`GU SOURCE CHECK OK: ${found.length} source/test/script files; no stale code or workflows.`);
 process.exit(0);
}
console.error(`GU SOURCE CHECK: ${extra.length} obsolete/unknown source/test/script files are still inside this repository:`);
for(const p of extra)console.error('  STALE:',p);
if(mode==='--check'){
 console.error('Run: node scripts/gu-fix20-source-guard.mjs --prune');
 console.error('This MOVES stale source/test/script files to a sibling backup folder, not a permanent delete.');
 process.exit(1);
}
// Only source/test/script files absent from the vetted release manifest are moved.
// The destination is a sibling of the repository, intentionally outside Git.
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=join(dirname(root),`${basename(root)}-stale-source-backup-${stamp}-${randomBytes(3).toString('hex')}`);
for(const p of extra){
 const from=resolve(root,p); const target=resolve(backup,p);
 if(!trackedGroups.some(g=>from.startsWith(resolve(root,g.root)+sep))||!target.startsWith(resolve(backup)+sep))throw Error('Unsafe source path');
 if(!statSync(from).isFile())throw Error('Not a regular file: '+from);
 mkdirSync(dirname(target),{recursive:true});
 renameSync(from,target);
}
console.log(`GU SOURCE PRUNE OK: moved ${extra.length} stale source/test/script files to ${backup}`);
console.log('Review this backup and your git diff before committing. No env, uploads, or .git files were changed.');
