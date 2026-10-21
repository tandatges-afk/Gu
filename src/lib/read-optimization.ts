/** GU v5.4: bounded, per-instance read-through cache and diagnostic counters.
 * Firestore writes MUST NOT trust data from here: reservations use fresh transactions.
 * Vercel instances do not share this cache or diagnostics.
 */
import {AsyncLocalStorage} from 'node:async_hooks';
import type {QuerySnapshot,DocumentSnapshot,DocumentData} from 'firebase-admin/firestore';

type Meter={endpoint:string;started:number;estReads:number;queries:number;cacheHits:number};
type Totals={calls:number;readsEstimate:number;queries:number;cacheHits:number;lastAt:string};
const context=new AsyncLocalStorage<Meter>();
const totals=new Map<string,Totals>();
const CACHE_MAX=140;
const cache=new Map<string,{expires:number;promise:Promise<unknown>}>();
export function estimatedReads(amount:number,queries=1){const c=context.getStore();if(c){c.estReads+=Math.max(0,amount);c.queries+=queries;}}
export function countQuery<T extends DocumentData>(snap:QuerySnapshot<T>):QuerySnapshot<T>{estimatedReads(Math.max(1,snap.size));return snap;}
export function countDoc<T extends DocumentData>(snap:DocumentSnapshot<T>):DocumentSnapshot<T>{estimatedReads(1);return snap;}
export function countGetAll<T extends DocumentData>(snap:DocumentSnapshot<T>[]):DocumentSnapshot<T>[]{estimatedReads(snap.length);return snap;}
export async function cached<T>(key:string,ttlMs:number,load:()=>Promise<T>):Promise<T>{
 const now=Date.now();const cachedValue=cache.get(key);
 if(cachedValue&&cachedValue.expires>now){const meter=context.getStore();if(meter)meter.cacheHits++;return cachedValue.promise as Promise<T>;}
 // Remove expired entries before inserting; cap per instance to prevent memory growth.
 if(cache.size>=CACHE_MAX)for(const [k,v] of cache){if(v.expires<=now||cache.size>=CACHE_MAX)cache.delete(k);}
 const entry={expires:now+Math.min(Math.max(ttlMs,1000),300_000),promise:Promise.resolve().then(load)};
 cache.set(key,entry);entry.promise.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
 return entry.promise as Promise<T>;
}
export async function measureRoute<T extends {headers:Headers}>(endpoint:string,fn:()=>Promise<T>):Promise<T>{
 const meter:Meter={endpoint,started:Date.now(),estReads:0,queries:0,cacheHits:0};
 return context.run(meter,async()=>{
  try{return await fn();}
  finally{
   const old=totals.get(endpoint)||{calls:0,readsEstimate:0,queries:0,cacheHits:0,lastAt:''};
   totals.set(endpoint,{calls:old.calls+1,readsEstimate:old.readsEstimate+meter.estReads,
    queries:old.queries+meter.queries,cacheHits:old.cacheHits+meter.cacheHits,lastAt:new Date().toISOString()});
   // No customer info or personal data in diagnostics.
   if(process.env.GU_READ_DIAGNOSTICS==='1')console.info('[GU_READ_V54]',JSON.stringify({endpoint,readsEstimate:meter.estReads,queries:meter.queries,cacheHits:meter.cacheHits,ms:Date.now()-meter.started}));
  }
 });
}
export function readMetrics(){return {scope:'warm-instance',disclaimer:'Ước tính số tài liệu được API đếm; không phải số tính phí Firestore. Chỉ những API đã instrument mới được tính. Cache không chia sẻ giữa các serverless instances.',endpoints:[...totals.entries()].map(([endpoint,row])=>({endpoint,...row})).sort((a,b)=>b.readsEstimate-a.readsEstimate)};}
