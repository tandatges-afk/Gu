import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const needed=[
 'src/lib/pg-firestore.ts','src/lib/pg-query-compiler.ts','src/lib/pg-dashboard-counts.ts',
 'src/lib/local-auth.ts','src/lib/local-media.ts','src/app/api/local-auth/route.ts',
 'src/app/api/bootstrap/route.ts','src/components/GuV5Booking.tsx',
 'src/components/GuReturnFlow.tsx','src/app/api/v5/secure-photo/route.ts',
 'scripts/bootstrap-postgresql.mjs','scripts/optimize-postgresql.mjs',
 'tests/vps-performance.test.ts','deploy-vps/gu-v546.service'
];
const missing=needed.filter(f=>!existsSync(join(process.cwd(),f)));
const p=JSON.parse(readFileSync('package.json','utf8'));
const badDeps=['firebase','firebase-admin','cloudinary'].filter(name=>p.dependencies?.[name]);
const problems=[...missing.map(f=>'Missing '+f),...badDeps.map(f=>'Provider dependency '+f)];
if(!p.version.startsWith('5.4.6-vps.'))problems.push('Invalid VPS version');
if(!p.scripts['db:optimize']||!p.scripts['db:bench'])problems.push('Missing PG maintenance scripts');
if(problems.length){console.error('GU VPS release verification failed:',problems.join('; '));process.exit(1);}
console.log('GU VPS release structure verified ('+p.version+'). External npm build, DB integration and acceptance remain required.');
