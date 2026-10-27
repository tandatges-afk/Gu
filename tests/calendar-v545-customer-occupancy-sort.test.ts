import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays} from '../src/lib/rental.ts';
import {calendarSlotState,sortCalendarProductsForDay} from '../src/lib/calendar-presentation.ts';
import type {InventoryItem,RentalOrder} from '../src/lib/types.ts';

const FIRST='2027-01-01';
function item(id:string):InventoryItem{
 return {id,name:id,sku:id,category:'Trang phục',size:'',color:'',dailyRate:50000,bufferDays:0,replacementValue:500000,status:'AVAILABLE',createdAt:FIRST};
}
function booking(id:string,itemIds:string[],startOffset:number,endOffset:number,customerId:string,status:RentalOrder['status']='RESERVED'):RentalOrder{
 return {id,code:id,customerId,customerName:'Khách trùng tên',customerPhone:'0900000000',
  pickupDate:addDays(FIRST,startOffset),returnDate:addDays(FIRST,endOffset),
  rentalDays:endOffset-startOffset+1,lines:itemIds.map(itemId=>({itemId,name:itemId,sku:itemId,size:'',dailyRate:50000,bufferDays:0,replacementValue:500000,lineTotal:50000})),
  total:50000,paid:50000,depositDue:0,note:'',status,createdAt:FIRST,updatedAt:FIRST,createdBy:'staff',history:[]};
}
function ids(items:InventoryItem[],day:string,orders:RentalOrder[]){
 return sortCalendarProductsForDay(items,day,orders,FIRST).map(x=>x.id);
}

test('G001 5 reserved dates > G002 3 > G003 2 > G004 1, with status of first visible date highest priority',()=>{
 const rows=['G004','G003','G002','G001'].map(item);
 const orders=[
  booking('b1',['G001'],0,4,'C1'),
  booking('b2',['G002'],0,2,'C2'),
  booking('b3',['G003'],1,2,'C3'),
  booking('b4',['G004'],1,1,'C4')
 ];
 assert.deepEqual(ids(rows,FIRST,orders),['G001','G002','G003','G004']);
 assert.equal(calendarSlotState(rows[0],FIRST,orders,FIRST).visual.className,'stateFree');
 assert.equal(calendarSlotState(rows[3],FIRST,orders,FIRST).visual.className,'stateReserved');
});

test('All empty today: prioritize occupied days over the next seven dates, not product name',()=>{
 const rows=['A-short','Z-long','M-middle','X-none'].map(item);
 const orders=[booking('b-long',['Z-long'],1,5,'L'),booking('b-middle',['M-middle'],1,3,'M'),booking('b-short',['A-short'],1,1,'S')];
 assert.deepEqual(ids(rows,FIRST,orders),['Z-long','M-middle','A-short','X-none']);
});

test('Rows of the SAME customer remain adjacent within a status, even if their booked-day counts differ',()=>{
 const rows=['c1-short','other-middle','c1-long','other-long'].map(item);
 const orders=[
  booking('a',['c1-short'],1,1,'same-customer'),
  booking('b',['c1-long'],1,3,'same-customer'),
  booking('c',['other-middle'],1,2,'other-customer'),
  booking('d',['other-long'],1,5,'third-customer')
 ];
 // Third customer first (5 cells), followed by one block of two items from same client (3+1 cells).
 assert.deepEqual(ids(rows,FIRST,orders),['other-long','c1-long','c1-short','other-middle']);
});

test('Different customer IDs with the same name are never treated as one client',()=>{
 const rows=['sameName-client1','sameName-client2','sameName-client1b'].map(item);
 const orders=[
  booking('o1',['sameName-client1'],1,3,'cust-A'),
  booking('o2',['sameName-client2'],1,4,'cust-B'),
  booking('o3',['sameName-client1b'],1,1,'cust-A')
 ];
 // Group A has 4 booked cells total, group B 4, tie resolved by max item booked days (B = 4).
 assert.deepEqual(ids(rows,FIRST,orders),['sameName-client2','sameName-client1','sameName-client1b']);
});

test('Sorting is recomputed for next first visible day and does not mutate source arrays',()=>{
 const rows=['A','B','C'].map(item);
 const orders=[booking('o-a',['A'],0,0,'A','PICKED_UP'),booking('o-b',['B'],1,2,'B'),booking('o-c',['C'],2,2,'C')];
 const day1=ids(rows,FIRST,orders);
 const day2=ids(rows,addDays(FIRST,1),orders);
 assert.deepEqual(day1,['A','B','C']);
 assert.deepEqual(day2,['B','C','A']);
 assert.deepEqual(rows.map(x=>x.id),['A','B','C']);
});

test('Multiple short camera orders in a single date count as one occupied day, distinct order count breaks ties',()=>{
 const rows=['short-twice','two-days','one-day'].map(item);
 const orders=[
  booking('a1',['short-twice'],1,1,'X'),
  booking('a2',['short-twice'],1,1,'Y'),
  booking('b1',['two-days'],1,2,'Z'),
  booking('c1',['one-day'],1,1,'W')
 ];
 assert.deepEqual(ids(rows,FIRST,orders),['two-days','short-twice','one-day']);
});

test('Only current-day status can set the primary urgency; shared customer cannot mix urgent and empty groups',()=>{
 const rows=['same-free','same-picked','other-reserved'].map(item);
 const orders=[
  booking('a',['same-picked'],0,1,'same','PICKED_UP'),
  booking('b',['same-free'],1,3,'same','RESERVED'),
  booking('c',['other-reserved'],0,0,'other','RESERVED')
 ];
 assert.deepEqual(ids(rows,FIRST,orders),['same-picked','other-reserved','same-free']);
});

test('Cancelled and returned orders do not influence occupancy grouping',()=>{
 const rows=['finished','future'].map(item);
 const orders=[booking('x',['finished'],1,6,'X','CANCELLED'),booking('y',['finished'],1,6,'Y','RETURNED'),booking('a',['future'],2,2,'A')];
 assert.deepEqual(ids(rows,FIRST,orders),['future','finished']);
});
