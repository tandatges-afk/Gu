import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mayArchiveItem} from '../src/lib/inventory-archive-rules.ts';

const route=readFileSync('src/app/api/items/[id]/route.ts','utf8');
const archive=route.split('export async function DELETE(')[1]||'';

test('Fix17: archive queries legacy and V5 intervals inside one locked transaction',()=>{
 assert.match(archive,/await db\(\)\.runTransaction\(async tx=>\{/);
 assert.match(archive,/tx\.get\(db\(\)\.collection\('rentalSlots'\)\.where\('itemId','==',id\)\.limit\(1\)\)/);
 assert.match(archive,/tx\.get\(db\(\)\.collection\('v5DayIntervals'\)\.where\('itemId','==',id\)\)/);
 assert.doesNotMatch(archive,/db\(\)\.collection\('v5DayIntervals'\)\.where\('itemId','==',id\)\.limit\(/);
 assert.match(archive,/mayArchiveItem\(legacyLocks\.size>0,hourlyLocks\.docs\.map\(d=>d\.data\(\)\)\)/);
 const posTxn=archive.indexOf('await db().runTransaction');
 assert.ok(posTxn<archive.indexOf('tx.get(db().collection(\'rentalSlots\')'));
 assert.ok(posTxn<archive.indexOf('tx.get(db().collection(\'v5DayIntervals\')'));
});

test('Fix17: an active reservation after five empty days blocks archiving',()=>{
 const many=[...Array.from({length:8},()=>({entries:[]})),{entries:[{orderId:'test-order',start:'a',end:'b'}]}];
 assert.equal(mayArchiveItem(false,many),false);
 assert.equal(mayArchiveItem(false,many.slice(0,8)),true);
});

test('Fix17: legacy slots or malformed records fail closed, no silent archive',()=>{
 assert.equal(mayArchiveItem(true,[]),false);
 assert.equal(mayArchiveItem(false,[]),true);
 assert.equal(mayArchiveItem(false,[{entries:[]}]),true);
 assert.equal(mayArchiveItem(false,[{}]),false);
 assert.equal(mayArchiveItem(false,[null]),false);
 assert.equal(mayArchiveItem(false,[{entries:null}]),false);
 assert.equal(mayArchiveItem(false,[{entries:{}}]),false);
});
