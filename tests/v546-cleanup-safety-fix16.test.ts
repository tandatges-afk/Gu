import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanupAllowed,orphanOldEnough,SENSITIVE_RETENTION_MS,ORPHAN_EVIDENCE_AGE_MS} from '../src/lib/sensitive-evidence-rules.ts';

const script=readFileSync('src/lib/sensitive-evidence-cleanup.ts','utf8');

test('Fix16: a sensitive proof is not eligible until the order is closed, 5 days elapsed and collateral returned',()=>{
 const returnedAt='2026-10-28T00:00:00.000Z';
 const ts=Date.parse(returnedAt);
 const order={status:'RETURNED',returnedAt,hadHandoverDeposit:true,collateralReturnedAt:'2026-10-28T02:00:00.000Z'};
 assert.equal(SENSITIVE_RETENTION_MS,5*24*60*60*1000);
 assert.equal(cleanupAllowed(order,ts+SENSITIVE_RETENTION_MS-1),false);
 assert.equal(cleanupAllowed(order,ts+SENSITIVE_RETENTION_MS),true);
 assert.equal(cleanupAllowed({...order,collateralReturnedAt:undefined},ts+SENSITIVE_RETENTION_MS*2),false);
 assert.equal(cleanupAllowed({...order,status:'PICKED_UP'},ts+SENSITIVE_RETENTION_MS*2),false);
});

test('Fix16: orphan images cannot be removed before 24 hours or when createdAt is invalid',()=>{
 const now=Date.parse('2026-10-28T12:00:00.000Z');
 assert.equal(ORPHAN_EVIDENCE_AGE_MS,24*60*60*1000);
 assert.equal(orphanOldEnough('2026-10-27T12:00:00.001Z',now),false);
 assert.equal(orphanOldEnough('2026-10-27T12:00:00.000Z',now),true);
 assert.equal(orphanOldEnough('garbage',now),false);
});

test('Fix16: orphan deletion transaction rechecks both owner binding and elapsed time',()=>{
 assert.match(script,/fresh\.data\(\)\?\.consumedOrderId!==null\|\|!orphanOldEnough\(fresh\.data\(\)\?\.createdAt\)/);
 assert.match(script,/cleanupState:'DELETING'/);
});

test('Fix16: not-yet-due cleanup is deferred without counting as failed or incrementing attempts',()=>{
 const block=script.split('for(const j of queue.docs){').at(-1)!;
 assert.match(block,/if\(order\.exists&&!cleanupAllowed\(order\.data\(\)\|\|\{\}\)\)/);
 assert.match(block,/deferred\+\+;/);
 assert.match(block,/await j\.ref\.update\(\{createdAt:new Date\(\)\.toISOString\(\)\}\);\s*continue;/);
 assert.match(block,/attempts:FieldValue\.increment\(1\)/);
 assert.match(block,/return \{done,failed:failed\+abandoned\.failed,deferred,/);
});
