import {test} from 'node:test';import assert from 'node:assert/strict';
import {rentForBlocks,billableBlocks,localDateTimeToISO,splitIntoVietnamDays} from '../src/lib/hourly-pricing.ts';
import {completeProof} from '../src/lib/inspection-proof.ts';
test('GU 24h tiers with every 5th day bump',()=>{assert.deepEqual(Array.from({length:10},(_,i)=>rentForBlocks('CLOTHING',i+1)),[50000,60000,70000,80000,130000,140000,150000,160000,170000,220000]);assert.deepEqual(Array.from({length:10},(_,i)=>rentForBlocks('ACCESSORY',i+1)),[20000,30000,40000,50000,70000,80000,90000,100000,110000,130000]);});
test('24h boundary does not depend on midnight',()=>{const a=localDateTimeToISO('2026-10-17T09:00');assert.equal(billableBlocks(a,localDateTimeToISO('2026-10-18T09:00')),1);assert.equal(billableBlocks(a,localDateTimeToISO('2026-10-18T09:01')),2);assert.equal(splitIntoVietnamDays(a,localDateTimeToISO('2026-10-18T10:00')).length,2);});
test('proof requires each angle on every item',()=>{const ids=['item1'];const angle={item1:['Cổ','Sau']};assert.equal(completeProof(ids,angle,[{itemId:'item1',shots:{Cổ:{url:'x',by:'a',byName:'',at:''}}}]),false);});
