import 'server-only';
import {randomBytes} from 'node:crypto';
import {Pool, type PoolClient} from 'pg';
import {compileGuQuery, type GuCondition, type GuOrdering, type GuAfter} from './pg-query-compiler';

/** GU V5 Firestore-shaped compatibility layer backed by PostgreSQL JSONB.
 * ALL writes for a rental transaction are serialized via a PostgreSQL advisory
 * transaction lock. This is intentionally conservative for a small rental shop.
 */
const poolGlobal=globalThis as typeof globalThis & {__guPgPool?:Pool};
export function pgPool():Pool{
 if(!poolGlobal.__guPgPool){
  if(!process.env.DATABASE_URL)throw Error('Thiếu DATABASE_URL của GU PostgreSQL.');
  poolGlobal.__guPgPool=new Pool({connectionString:process.env.DATABASE_URL,max:16,idleTimeoutMillis:30000});
 }
 return poolGlobal.__guPgPool;
}
const schemaGlobal=globalThis as typeof globalThis & {__guSchemaReady?:Promise<void>};
export async function initializeSchema(){
 if(schemaGlobal.__guSchemaReady)return schemaGlobal.__guSchemaReady;
 schemaGlobal.__guSchemaReady=(async()=>{
 await pgPool().query(`CREATE TABLE IF NOT EXISTS gu_documents(
   collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb,
   updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection,id)
 )`);
 await pgPool().query('CREATE INDEX IF NOT EXISTS gu_docs_collection_updated ON gu_documents(collection,updated_at DESC)');
 await pgPool().query(`CREATE TABLE IF NOT EXISTS gu_login_attempts (email text PRIMARY KEY,failures int NOT NULL DEFAULT 0,first_failure_at timestamptz NOT NULL DEFAULT now())`);
 await pgPool().query(`CREATE TABLE IF NOT EXISTS gu_accounts (
  uid text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL, disabled boolean NOT NULL DEFAULT false,
  revoked_after timestamptz, created_at timestamptz NOT NULL DEFAULT now()
 )`);
 })().catch(error=>{schemaGlobal.__guSchemaReady=undefined;throw error;});
 return schemaGlobal.__guSchemaReady;
}
export type GuValue=Record<string,unknown>;
const SENTINEL='__gu_pg_field_operation_';
export const FieldValue={
 increment:(by:number)=>({[SENTINEL]:'increment',by}),
 delete:()=>({[SENTINEL]:'delete'}),
 serverTimestamp:()=>({[SENTINEL]:'timestamp'}),
 arrayUnion:(...values:unknown[])=>({[SENTINEL]:'union',values}),
 arrayRemove:(...values:unknown[])=>({[SENTINEL]:'remove',values})
};
export const FieldPath={documentId:()=> '__name__'};
function clean(value:unknown):unknown{
 if(value===undefined)return undefined;
 if(Array.isArray(value))return value.map(clean).filter(v=>v!==undefined);
 if(value&&typeof value==='object'&&!(value instanceof Date)){
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]));
 }
 return value instanceof Date?value.toISOString():value;
}
function applyWrite(old:GuValue,input:GuValue,merge:boolean):GuValue{
 const result:GuValue=merge?structuredClone(old):{};
 for(const [path,raw] of Object.entries(input)){
  if(raw===undefined)continue;
  const fields=path.split('.');let obj:GuValue=result;
  for(const field of fields.slice(0,-1)){
   if(!obj[field]||typeof obj[field]!=='object'||Array.isArray(obj[field]))obj[field]={};
   obj=obj[field] as GuValue;
  }
  const field=fields.at(-1)!;
  const op=(raw as Record<string,unknown>|null)?.[SENTINEL];
  if(op==='delete'){delete obj[field];continue;}
  if(op==='increment'){obj[field]=Number(obj[field]||0)+Number((raw as GuValue).by||0);continue;}
  if(op==='timestamp'){obj[field]=new Date().toISOString();continue;}
  if(op==='union'){obj[field]=[...new Set([...(Array.isArray(obj[field])?obj[field] as unknown[]:[]),...((raw as GuValue).values as unknown[])])];continue;}
  if(op==='remove'){const remove=(raw as GuValue).values as unknown[];obj[field]=(Array.isArray(obj[field])?obj[field] as unknown[]:[]).filter(x=>!remove.includes(x));continue;}
  obj[field]=clean(raw);
 }
 return result;
}
function validSegment(s:string){if(!s||s.length>300||s.includes('/')||s.includes('\0'))throw Error('Mã document không hợp lệ.');return s;}
export class DocumentSnapshot{
 constructor(public readonly ref:DocumentReference,private readonly row:GuValue|undefined){}
 get id(){return this.ref.id;}
 get exists(){return this.row!==undefined;}
 data():any{return this.row===undefined?undefined:structuredClone(this.row);}
 get(field:string):any{return field==='__name__'?this.id:field.split('.').reduce<unknown>((o,k)=>o&&typeof o==='object'?(o as GuValue)[k]:undefined,this.row);}
}
export class DocumentReference{
 constructor(public readonly path:string){}
 get id(){return this.path.split('/').at(-1)!;}
 get parent(){return new CollectionReference(this.path.split('/').slice(0,-1).join('/'));}
 collection(s:string){return new CollectionReference(this.path+'/'+validSegment(s));}
 async get(){return loadDoc(this);}
 async set(data:GuValue,options?:{merge?:boolean}){return writeDoc('set',this,data,options?.merge);}
 async update(data:GuValue){return writeDoc('update',this,data);}
 async create(data:GuValue){return writeDoc('create',this,data);}
 async delete(){return writeDoc('delete',this);}
}
export type QueryDocumentSnapshot=DocumentSnapshot;
export class QuerySnapshot{
 constructor(public readonly docs:DocumentSnapshot[]){}
 get empty(){return this.docs.length===0;}
 get size(){return this.docs.length;}
 forEach(fn:(d:DocumentSnapshot)=>void){this.docs.forEach(fn);}
}
type Condition=GuCondition;
type Ordering=GuOrdering;
export class Query{
 constructor(public readonly name:string,private readonly conditions:Condition[]=[],private readonly ordering:Ordering[]=[],private readonly cap?:number,private readonly bounds:Record<string,unknown>={},private readonly after?:GuAfter){}
 protected copy(changes:Partial<{conditions:Condition[];ordering:Ordering[];cap:number;bounds:Record<string,unknown>;after:GuAfter}>):Query{
  return new Query(this.name,changes.conditions??this.conditions,changes.ordering??this.ordering,changes.cap??this.cap,changes.bounds??this.bounds,changes.after??this.after);
 }
 where(field:string,op:string,value:unknown):Query{return this.copy({conditions:[...this.conditions,{field,op,value}]});}
 orderBy(field:string,dir:'asc'|'desc'='asc'):Query{return this.copy({ordering:[...this.ordering,{field,dir}]});}
 limit(n:number):Query{return this.copy({cap:n});}
 select(..._fields:string[]):Query{return this;}
 startAt(value:string):Query{return this.copy({bounds:{...this.bounds,startAt:value}});}
 endAt(value:string):Query{return this.copy({bounds:{...this.bounds,endAt:value}});}
 endBefore(value:string):Query{return this.copy({bounds:{...this.bounds,endBefore:value}});}
 startAfter(value:string|DocumentSnapshot,...more:string[]):Query{
  if(typeof value==='string'){
   if(this.ordering.some(o=>o.field==='__name__')){
    const i=this.ordering.findIndex(o=>o.field==='__name__');
    return this.copy({after:{id:i===0?value:String(more[i-1]||''),values:[value,...more]}});
   }
   if(!this.ordering.length)return this.copy({after:{id:value,values:[]}});
   // A plain value is a boundary on the primary ordered field.
   return this.copy({after:{id:more.length?more.at(-1)!:'',values:[value,...more]}});
  }
  return this.copy({after:{id:value.id,values:this.ordering.map(o=>value.get(o.field))}});
 }
 async get(client?:PoolClient):Promise<QuerySnapshot>{
  const {sql,params}=compileGuQuery({name:this.name,conditions:this.conditions,ordering:this.ordering,cap:this.cap,bounds:this.bounds,after:this.after});
  const r=await (client||pgPool()).query(sql,params);
  return new QuerySnapshot(r.rows.map((row:{id:string;data:GuValue})=>new DocumentSnapshot(new DocumentReference(`${this.name}/${row.id}`),row.data)));
 }
 count(){return {get:async()=>{
   const {sql,params}=compileGuQuery({name:this.name,conditions:this.conditions,ordering:this.ordering,cap:this.cap,bounds:this.bounds,after:this.after},'count');
   const r=await pgPool().query(sql,params);
   return {data:()=>({count:Number(r.rows[0]?.count||0)})};
  }};}

}
export class CollectionReference extends Query{
 constructor(public readonly path:string){super(path);}
 doc(id?:string){return new DocumentReference(this.path+'/'+validSegment(id||randomBytes(16).toString('hex')));}
 async add(data:GuValue){const ref=this.doc();await ref.create(data);return ref;}
}
async function loadDoc(ref:DocumentReference,client?:PoolClient){const parts=ref.path.split('/');const id=parts.pop()!,collection=parts.join('/');const result=await (client||pgPool()).query('SELECT data FROM gu_documents WHERE collection=$1 AND id=$2',[collection,id]);return new DocumentSnapshot(ref,result.rows[0]?.data);}
type Write={kind:'set'|'update'|'create'|'delete';ref:DocumentReference;data?:GuValue;merge?:boolean};
async function execWrite(w:Write,client:PoolClient){
 const parts=w.ref.path.split('/');const id=parts.pop()!,collection=parts.join('/');
 if(w.kind==='delete'){await client.query('DELETE FROM gu_documents WHERE collection=$1 AND id=$2',[collection,id]);return;}
 const current=await loadDoc(w.ref,client);
 if(w.kind==='create'&&current.exists){const e=new Error('Document already exists') as Error&{code?:string};e.code='already-exists';throw e;}
 if(w.kind==='update'&&!current.exists)throw Error('Document missing');
 const data=applyWrite(current.data()||{},w.data||{},w.kind==='update'||Boolean(w.merge));
 await client.query(`INSERT INTO gu_documents(collection,id,data) VALUES($1,$2,$3::jsonb)
  ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data,updated_at=now()`,[collection,id,JSON.stringify(data)]);
}
async function writeDoc(kind:Write['kind'],ref:DocumentReference,data?:GuValue,merge?:boolean){
 const client=await pgPool().connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(702546)');await execWrite({kind,ref,data,merge},client);await client.query('COMMIT');}
 catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export class Transaction{
 private writes:Write[]=[];
 constructor(private client:PoolClient){}
 get(target:DocumentReference):Promise<DocumentSnapshot>;
 get(target:Query):Promise<QuerySnapshot>;
 get(target:DocumentReference|Query):Promise<DocumentSnapshot|QuerySnapshot>{return target instanceof DocumentReference?loadDoc(target,this.client):target.get(this.client);}
 set(ref:DocumentReference,data:GuValue,opts?:{merge?:boolean}){this.writes.push({kind:'set',ref,data,merge:opts?.merge});return this;}
 update(ref:DocumentReference,data:GuValue){this.writes.push({kind:'update',ref,data});return this;}
 create(ref:DocumentReference,data:GuValue){this.writes.push({kind:'create',ref,data});return this;}
 delete(ref:DocumentReference){this.writes.push({kind:'delete',ref});return this;}
 async flush(){for(const w of this.writes)await execWrite(w,this.client);}
}
export type Firestore=ReturnType<typeof db>;
export function db(){return {
  collection:(path:string)=>new CollectionReference(path),
  getAll:async(...refs:DocumentReference[])=>{
   if(!refs.length)return [] as DocumentSnapshot[];
   // GU calendar can request 30 products x 7 days x 2 slot collections.
   // Grouping by collection reduces 420+ round trips to a handful of queries.
   const groups=new Map<string,Set<string>>();
   for(const ref of refs){
    const parts=ref.path.split('/'),id=parts.pop()!,collection=parts.join('/');
    if(!groups.has(collection))groups.set(collection,new Set());
    groups.get(collection)!.add(id);
   }
   const found=new Map<string,GuValue>();
   await Promise.all([...groups].map(async ([collection,ids])=>{
    const result=await pgPool().query('SELECT id,data FROM gu_documents WHERE collection=$1 AND id=ANY($2::text[])',[collection,[...ids]]);
    for(const row of result.rows as {id:string;data:GuValue}[])found.set(collection+'/'+row.id,row.data);
   }));
   return refs.map(ref=>new DocumentSnapshot(ref,found.get(ref.path)));
  },
  runTransaction:async<T>(fn:(tx:Transaction)=>Promise<T>):Promise<T>=>{
   const client=await pgPool().connect();try{
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query('SELECT pg_advisory_xact_lock(702546)');
    const tx=new Transaction(client),result=await fn(tx);await tx.flush();await client.query('COMMIT');return result;
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  },
  batch:()=>{
   const writes:Write[]=[];return {
    create:(ref:DocumentReference,data:GuValue)=>{writes.push({kind:'create',ref,data});},
    set:(ref:DocumentReference,data:GuValue,opts?:{merge?:boolean})=>{writes.push({kind:'set',ref,data,merge:opts?.merge});},
    update:(ref:DocumentReference,data:GuValue)=>{writes.push({kind:'update',ref,data});},
    delete:(ref:DocumentReference)=>{writes.push({kind:'delete',ref});},
    commit:async()=>{const client=await pgPool().connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(702546)');for(const w of writes)await execWrite(w,client);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
   };
  }
};}
