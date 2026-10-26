/** Batched calendar data loader shared by all calendar filters and pages.
 * A bounded complete set is required: never silently turn an incomplete query into free inventory.
 */
import {db} from './firebase-admin';
import type {Query,QueryDocumentSnapshot} from 'firebase-admin/firestore';
import {cached,countQuery} from './read-optimization';
import type {InventoryItem,RentalOrder} from './types';
import {addDays} from './rental';
export const MAX_CALENDAR_ITEMS=Number(process.env.GU_MAX_CALENDAR_ITEMS||20000);
export const MAX_CALENDAR_ORDERS=Number(process.env.GU_MAX_CALENDAR_ORDERS||40000);
async function loadCollection<T>(q:Query,limit:number):Promise<T[]>{
 const results:T[]=[];
 let cursor:QueryDocumentSnapshot|undefined;
 while(results.length<=limit){
  const take=Math.min(250,limit+1-results.length);
  let page=q.limit(take);
  if(cursor)page=page.startAfter(cursor);
  const batch=countQuery(await page.get());
  results.push(...batch.docs.map(d=>({id:d.id,...d.data()} as T)));
  if(batch.size<take)break;
  cursor=batch.docs[batch.docs.length-1];
 }
 if(results.length>limit)throw Error('CALENDAR_TOO_MANY_ROWS');
 return results;
}
export async function calendarData(start:string,fresh=false,withItems=true){
 const end=addDays(start,6);
 const itemLoader=()=>loadCollection<InventoryItem>(db().collection('items').orderBy('name'),MAX_CALENDAR_ITEMS);
 const items=withItems?(fresh?await itemLoader():await cached('calendar:all-items:v553',60_000,itemLoader)):[];
 // The due-date query sees reservations, live rentals and historical returned orders.
 // The second query includes overdue rentals whose planned return date is before this week.
 // The third includes previously overdue rentals actually returned during this week.
 const orderLoader=()=>Promise.all([
  loadCollection<RentalOrder>(db().collection('orders').where('returnDate','>=',start).orderBy('returnDate'),MAX_CALENDAR_ORDERS),
  loadCollection<RentalOrder>(db().collection('orders').where('status','==','PICKED_UP').orderBy('status'),MAX_CALENDAR_ORDERS),
  loadCollection<RentalOrder>(db().collection('orders').where('returnedAt','>=',new Date(start+'T00:00:00+07:00').toISOString()).orderBy('returnedAt'),MAX_CALENDAR_ORDERS)
 ]);
 const results=fresh?await orderLoader():await cached('calendar:all-orders:v553:'+start,45_000,orderLoader);
 const orders=[...new Map(results.flat().filter(o=>o.pickupDate<=end&&o.status!=='CANCELLED'&&o.status!=='VOIDED').map(o=>[o.id,o])).values()];
 if(orders.length>MAX_CALENDAR_ORDERS)throw Error('CALENDAR_TOO_MANY_ROWS');
 return {items:items.filter(x=>!x.archivedAt),orders};
}

/** Unfiltered/category-only calendar: read the visible page, not the entire product catalog. */
export async function calendarFastPage(category:string,offset:number){
 const query=category==='ALL'
  ? db().collection('items').orderBy('name')
  : db().collection('items').where('category','==',category).orderBy('category');
 const collected:Array<{item:InventoryItem;index:number}>=[];
 let scanned=0;
 let more=true;
 // Each query is bounded; cursors identify the next *source* document, not the next filtered row.
 while(collected.length<26&&more){
  const limit=50;
  const snap=countQuery(await query.offset(offset+scanned).limit(limit).get());
  for(let j=0;j<snap.size;j++){
   const d=snap.docs[j];
   if(!d.data().archivedAt)collected.push({item:{id:d.id,...d.data()} as InventoryItem,index:offset+scanned+j});
  }
  scanned+=snap.size;
  more=snap.size===limit;
 }
 const last=collected[24];
 return {items:collected.slice(0,25).map(x=>x.item),next:last&&(collected.length>25||more)?String(last.index+1):null};
}
