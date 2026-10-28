import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(f:string)=>readFileSync(f,'utf8');
test('Fix20 release and lockfile versions agree',()=>{
 const pkg=JSON.parse(src('package.json'));const lock=JSON.parse(src('package-lock.json'));
 assert.equal(pkg.version,'5.4.6-fix20.0');assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
});
test('Fix17: creates a durable idempotency marker in the same transaction as rental/stock/cash',()=>{
 const s=src('src/app/api/v5/orders/route.ts');
 assert.match(s,/collection\('orderCreateRequests'\)/);
 assert.match(s,/const prior=await tx\.get\(requestRef\)/);
 assert.match(s,/prior\.data\(\)\?\.fingerprint!==fingerprint/);
 assert.match(s,/if\(requestRef\)tx\.create\(requestRef/);
 assert.match(s,/checkIntervalAvailability\(tx,slots\)/);
 assert.match(s,/createIntervalWrites\(tx,slots,snapshots,orderRef\.id\)/);
 assert.match(s,/orderRef\.id\.slice\(0,12\)/);
});
test('Fix17: payment retry uses a durable requestId and cannot increment twice',()=>{
 const s=src('src/app/api/v5/orders/[id]/route.ts');
 assert.match(s,/const previously=await tx\.get\(movement\)/);
 assert.match(s,/if\(previously\.exists\)/);
 assert.match(s,/movement=ref\.collection\('cashMovements'\)\.doc\(requestId\)/);
 assert.match(s,/tx\.create\(movement,/);
});
test('Fix17: stock only transitions on valid initial order states',()=>{
 const s=src('src/app/api/v5/orders/[id]/route.ts');
 assert.match(s,/if\(order\.status!=='RESERVED'\)/);
 assert.match(s,/order\.status!=='PICKED_UP'/);
 assert.match(s,/if\(order\.collateralReturnedAt\)/);
});
test('Fix18: read-only audit contains overlap, stock, payments, duplicated order checks',()=>{
 const s=src('scripts/gu-fix20-audit.mjs');
 assert.match(s,/BEGIN READ ONLY/);
 for(const token of ['DUPLICATE_ORDER_CODE','STOCK_ORDER_STATE_MISMATCH','OVERLAPPING_RENTAL_INTERVALS','V5_NET_PAID_LEDGER_MISMATCH','INVALID_CASH_MOVEMENT'])assert.ok(s.includes(token));
 assert.doesNotMatch(s,/client\.query\('DELETE FROM gu_documents/);
});
test('Fix19: search for add-on rental items is debounced and ignores stale results',()=>{
 const s=src('src/components/GuV5Review.tsx');
 assert.match(s,/setTimeout\(\(\)=>\{/);assert.match(s,/if\(!disposed\)setAddResults/);
 assert.match(s,/clearTimeout\(timer\)/);
});
test('Fix20: bytes are bounded even when chunked uploads lack Content-Length',()=>{
 const s=src('src/lib/http.ts');
 assert.match(s,/reader\.read\(\)/);assert.match(s,/total>max/);
 for(const file of ['src/app/api/uploads/route.ts','src/app/api/v5/secure-photo/route.ts'])assert.match(src(file),/boundedUploadBytes\(req\)/);
});
test('Fix20: deprecated backup fails closed; replacement is encrypted and offsite',()=>{
 const backup=src('deploy-vps/gu-fix20-encrypted-offsite-backup.sh');
 assert.match(backup,/pg_dump -Fc/);assert.match(backup,/gpg --batch/);assert.match(backup,/rclone copyto/);
 assert.match(backup,/gu_v546_prod/);assert.match(backup,/gu-v546-prod\/uploads/);
 assert.match(src('deploy-vps/gu-v546-backup.sh'),/exit 3/);
});
test('Fix20: production cannot be automatically deployed from main',()=>{
 const workflow=src('.github/workflows/deploy-main.yml');
 assert.match(workflow,/github\.event_name == 'workflow_dispatch' && inputs\.target == 'prod'/);
 assert.doesNotMatch(workflow,/github\.event_name == 'push' \|\|/);
 assert.match(src('vps-main/gu-v5-release'),/npm run db:preflight/);
});
test('Fix20: orphan image deletion requires confirmation and excludes evidence',()=>{
 const gc=src('scripts/gu-fix20-product-photo-gc.mjs');
 assert.match(gc,/GU_ACK_PHOTO_GC/);assert.match(gc,/30\*86400_000/);
 assert.match(gc,/join\(base,'products'\)/);assert.match(gc,/referencePhotos/);
});

test('Fix20 review: orphan photo cleanup is bound to the matching stage/production uploads directory',()=>{
 const s=src('scripts/gu-fix20-product-photo-gc.mjs');
 assert.match(s,/name==='gu_v546_prod'/);
 assert.match(s,/gu-v546-prod\/uploads/);
 assert.match(s,/if\(base!==expectedDir\)throw/);
});
test('Fix20 review: preflight checks actual valid and ready PostgreSQL indexes',()=>{
 const s=src('scripts/gu-fix20-preflight.mjs');
 for(const token of ['pg_index','indisvalid','indisready','indisunique','Invalid/unready index'])assert.ok(s.includes(token));
});
test('Fix20 review: optimizer rejects wrong database and remote PG even if override is set',()=>{
 const s=src('scripts/optimize-postgresql.mjs');
 assert.match(s,/gu_v546_stage','gu_v546_prod/);
 assert.match(s,/127\.0\.0\.1','localhost/);
 assert.match(s,/GU_OPTIMIZE_ALLOW_OTHER_DB/);
});
