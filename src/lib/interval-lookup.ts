/** Sparse calendar/availability lookups: read existing interval documents only.
 * Access pattern is two document-name range queries per product, not N x days getAll.
 * All booking writes and conflict validation MUST continue using fresh transactions.
 */
import {FieldPath} from 'firebase-admin/firestore';
import {db} from './firebase-admin';
import {countQuery} from './read-optimization';
import {slotId} from './rental';
import type {ExistingInterval} from './hourly-availability';
export type DayLock={legacy:boolean;legacyOrderId?:string;entries:ExistingInterval[]};
export async function findDayLocks(ids:string[],days:string[],maxConcurrent=6):Promise<Map<string,DayLock>>{
 const result=new Map<string,DayLock>();
 if(!ids.length||!days.length)return result;
 const first=days[0],last=days[days.length-1];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(first)||!/^\d{4}-\d{2}-\d{2}$/.test(last)||last<first)throw Error('Khoảng ngày tra cứu khóa không hợp lệ.');
 let position=0;
 async function worker(){
  while(position<ids.length){
   const id=ids[position++];
   const old=db().collection('rentalSlots').orderBy(FieldPath.documentId())
    .startAt(slotId(id,first)).endAt(slotId(id,last));
   const timed=db().collection('v5DayIntervals').orderBy(FieldPath.documentId())
    .startAt(id+'_'+first).endAt(id+'_'+last);
   const [legacy,modern]=await Promise.all([old.get(),timed.get()]);
   countQuery(legacy);countQuery(modern);
   for(const doc of legacy.docs){const day=doc.id.slice(-10);result.set(id+'|'+day,{legacy:true,legacyOrderId:String(doc.data()?.orderId||''),entries:[]});}
   for(const doc of modern.docs){const day=doc.id.slice(-10),key=id+'|'+day;
    const prior=result.get(key);result.set(key,{legacy:prior?.legacy||false,legacyOrderId:prior?.legacyOrderId,entries:(doc.data()?.entries||[]) as ExistingInterval[]});}
  }
 }
 await Promise.all(Array.from({length:Math.min(maxConcurrent,ids.length)},()=>worker()));
 return result;
}
