import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanupAllowed,orphanOldEnough} from '../src/lib/sensitive-evidence-rules.ts';
import {addCompletedRound,KEEP_INSPECTION_ROUNDS} from '../src/lib/evidence-retention-rules.ts';
const read=(path:string)=>readFileSync(path,'utf8');
test('never purge customer IDs at staff return: wait for explicit Admin photo review',()=>{
 assert.equal(cleanupAllowed({status:'RETURNED',returnStage:'APPROVED',photoReviewStatus:'PENDING'}),false);
 assert.equal(cleanupAllowed({status:'RETURNED',photoReviewStatus:'REVIEWED'}),true);
 assert.equal(cleanupAllowed({status:'RETURNED',returnStage:'APPROVED',reviewedAt:'2026-10-21T00:00:00Z'}),true);
 assert.equal(cleanupAllowed({status:'PICKED_UP',photoReviewStatus:'REVIEWED'}),false);
 assert.equal(cleanupAllowed({status:'CANCELLED'}),true);
});
test('abandoned form photos expire after 24h, not while users are actively booking',()=>{
 const now=Date.parse('2026-10-22T12:00:00Z');
 assert.equal(orphanOldEnough('2026-10-21T12:00:00Z',now),true);
 assert.equal(orphanOldEnough('2026-10-22T11:55:00Z',now),false);
 assert.equal(orphanOldEnough('bad-date',now),false);
});
test('only Admin approval advances the seven completed inspection photo rounds',()=>{
 const route=read('src/app/api/v5/orders/[id]/route.ts');
 const receive=route.split("}else if(action==='RECEIVE'){")[1].split("}else if(action==='REVIEW_PHOTOS'){")[0];
 const review=route.split("}else if(action==='REVIEW_PHOTOS'){")[1].split("}else if(action==='RETURN_COLLATERAL'){")[0];
 assert.doesNotMatch(receive,/addCompletedRound\(/);
 assert.match(review,/addCompletedRound\(/);
 assert.match(review,/queueSensitiveEvidenceCleanup\(tx,id,now\)/);
 const result=addCompletedRound(Array.from({length:7},(_,i)=>({orderId:'order'+i,completedAt:`2026-10-${String(i+1).padStart(2,'0')}`})),{orderId:'order7',completedAt:'2026-10-08'});
 assert.equal(KEEP_INSPECTION_ROUNDS,7);assert.equal(result.keep.length,7);assert.equal(result.expired.length,1);
});
test('Cloudinary deletion invalidates cached original/derivatives and is retried before metadata removal',()=>{
 const secure=read('src/lib/cloudinary-secure.ts'),cleanup=read('src/lib/sensitive-evidence-cleanup.ts');
 assert.match(secure,/URLSearchParams\(\{invalidate:'true'\}\)/);
 assert.match(secure,/body.set\('backup','false'\)/);
 assert.ok(cleanup.indexOf('await removeRemote(doc)')<cleanup.indexOf('tx.delete(d.ref)'));
 assert.match(cleanup,/consumedOrderId/);
 assert.match(cleanup,/cleanupState:'DELETING'/);
 assert.match(cleanup,/queueReviewedEvidenceBackfill/);
 assert.match(cleanup,/reservationPaymentProofId:FieldValue.delete\(\)/);
 assert.match(cleanup,/handoverDepositProofId:FieldValue.delete\(\)/);
});
test('private images are unreadable after approval even while retry jobs are pending',()=>{
 const viewer=read('src/app/api/v5/secure-photo/route.ts');
 assert.match(viewer,/sensitiveEvidenceStatus/);
 assert.match(viewer,/photoReviewStatus==='REVIEWED'/);
 assert.match(viewer,/Cache-Control':'private,no-store/);
 const backup=read('scripts/backup-firestore.mjs');
 assert.match(backup,/delete copy.handoverProof/);
 assert.match(backup,/delete copy.reservationPaymentProofId/);
});
