import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationPeriod,vnDate,isoWeekMonday,shiftSlots,uniqueSelections,currentStaffAccess,applyStaffRegistration,rosterStats,type ShiftWeekRecord} from '../src/lib/shift-schedule.ts';
const monday='2026-10-26';
const ids=shiftSlots(monday).filter(s=>s.id==='S1').slice(0,5).map(s=>s.key);
const at=(x:string)=>new Date(x);
test('VN timezone and Monday across Sunday night',()=>{
 assert.equal(vnDate(at('2026-10-25T17:10:00Z')),'2026-10-26');
 assert.equal(isoWeekMonday('2026-10-25'),'2026-10-19');
 assert.equal(isoWeekMonday('2026-10-26'),'2026-10-26');
 assert.equal(shiftSlots(monday).length,21);
});
test('Sunday registration window 12:00 inclusive and 20:00 exclusive',()=>{
 assert.equal(registrationPeriod(at('2026-10-25T04:59:59Z')).isOpen,false);
 assert.equal(registrationPeriod(at('2026-10-25T05:00:00Z')).isOpen,true);
 assert.equal(registrationPeriod(at('2026-10-25T12:59:59Z')).isOpen,true);
 assert.equal(registrationPeriod(at('2026-10-25T13:00:00Z')).isOpen,false);
 assert.equal(registrationPeriod(at('2026-10-25T12:00:00Z')).weekStart,monday);
 assert.equal(registrationPeriod(at('2026-10-25T13:00:00Z')).weekStart,'2026-11-02');
 assert.equal(registrationPeriod(at('2026-10-20T00:00:00Z')).weekStart,monday);
});
test('minimum five DISTINCT work days (not five shifts in same day)',()=>{
 assert.deepEqual(uniqueSelections(ids,monday),ids);
 assert.throws(()=>uniqueSelections(shiftSlots(monday).slice(0,5).map(s=>s.key),monday),/ít nhất 5/);
 assert.throws(()=>uniqueSelections([...ids,ids[0]],monday),/trùng/);
 assert.throws(()=>uniqueSelections([...ids,'2026-11-02_S1'],monday),/ngoài tuần/);
});
test('first two seats filled; third rejected and original roster unchanged',()=>{
 let roster: ShiftWeekRecord['seats'] = {};
 roster=applyStaffRegistration({weekStart:monday,seats:roster,uid:'a',name:'A',slotIds:ids,now:'2026-10-25T05:00:00Z'}).seats;
 roster=applyStaffRegistration({weekStart:monday,seats:roster,uid:'b',name:'B',slotIds:ids,now:'2026-10-25T05:00:01Z'}).seats;
 assert.deepEqual(roster[ids[0]].map(x=>x.uid),['a','b']);
 assert.throws(()=>applyStaffRegistration({weekStart:monday,seats:roster,uid:'c',name:'C',slotIds:ids,now:'2026-10-25T05:00:02Z'}),/đủ 2/);
 assert.deepEqual(roster[ids[0]].map(x=>x.uid),['a','b']);
 const res=applyStaffRegistration({weekStart:monday,seats:roster,uid:'a',name:'A',slotIds:ids,now:'2026-10-25T06:00:00Z'});
 assert.equal(res.seats[ids[0]].find(x=>x.uid==='a')?.registeredAt,'2026-10-25T05:00:00Z');
 assert.equal(rosterStats(roster,monday).length,2);
 assert.ok(rosterStats(roster,monday).every(x=>x.days===5&&x.compliant));
});
test('valid working shift; grace for 15 min; no session between split shifts',()=>{
 const slots=shiftSlots(monday);
 const seats={
  [slots[0].key]:[{uid:'a',name:'A',registeredAt:'2026-10-25T05:00Z'}],
  [slots[2].key]:[{uid:'a',name:'A',registeredAt:'2026-10-25T05:00Z'}],
 };
 const record={weekStart:monday,seats} as ShiftWeekRecord;
 assert.equal(currentStaffAccess(at('2026-10-26T00:59:59Z'),'a',record).canWork,false);
 assert.equal(currentStaffAccess(at('2026-10-26T01:00:00Z'),'a',record).canWork,true);
 assert.equal(currentStaffAccess(at('2026-10-26T06:10:00Z'),'a',record).grace,true);
 assert.equal(currentStaffAccess(at('2026-10-26T06:15:00Z'),'a',record).canWork,false);
 assert.equal(currentStaffAccess(at('2026-10-26T10:59:00Z'),'a',record).canWork,false);
 assert.equal(currentStaffAccess(at('2026-10-26T11:00:00Z'),'a',record).canWork,true);
 assert.equal(currentStaffAccess(at('2026-10-26T15:15:00Z'),'a',record).canWork,false);
 assert.equal(currentStaffAccess(at('2026-10-26T02:00:00Z'),'b',record).canWork,false);
});
test('back-to-back shifts continuously grant access without forced logout',()=>{
 const slots=shiftSlots(monday);
 const record={weekStart:monday,seats:{[slots[0].key]:[{uid:'a',name:'A',registeredAt:'x'}],[slots[1].key]:[{uid:'a',name:'A',registeredAt:'x'}]}} as ShiftWeekRecord;
 assert.equal(currentStaffAccess(at('2026-10-26T05:59:59Z'),'a',record).canWork,true);
 assert.equal(currentStaffAccess(at('2026-10-26T06:00:00Z'),'a',record).canWork,true);
 assert.equal(currentStaffAccess(at('2026-10-26T11:14:59Z'),'a',record).canWork,true);
 assert.equal(currentStaffAccess(at('2026-10-26T11:15:00Z'),'a',record).canWork,false);
});
