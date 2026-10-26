import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupAllowed,orphanOldEnough} from '../src/lib/sensitive-evidence-rules.ts';
test('sensitive evidence cleanup requires explicit admin approval and returned order',()=>{
 assert.equal(cleanupAllowed({status:'RETURNED'}),false);
 assert.equal(cleanupAllowed({status:'PICKED_UP',sensitiveEvidenceCleanupApproved:true,sensitiveEvidenceCleanupApprovedAt:'2026-10-01T00:00:00.000Z'}),false);
 assert.equal(cleanupAllowed({status:'RETURNED',sensitiveEvidenceCleanupApproved:true,sensitiveEvidenceCleanupApprovedAt:'2026-10-01T00:00:00.000Z'}),true);
});
test('orphan deletion is disabled by default',()=>{
 assert.equal(orphanOldEnough('2020-01-01T00:00:00.000Z'),false);
});
