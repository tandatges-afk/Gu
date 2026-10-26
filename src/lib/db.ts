import 'server-only';
import {Pool,type PoolClient,type QueryResultRow} from 'pg';
declare global { var __guPool:Pool|undefined; }
export function pool():Pool {if(!process.env.DATABASE_URL)throw Error('Thiếu DATABASE_URL'); return globalThis.__guPool??=new Pool({connectionString:process.env.DATABASE_URL,max:12,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,ssl:false});}
export async function rows<T extends QueryResultRow>(sql:string,args:unknown[]=[]):Promise<T[]>{return (await pool().query<T>(sql,args)).rows;}
export async function tx<T>(callback:(db:PoolClient)=>Promise<T>):Promise<T>{const c=await pool().connect();try{await c.query('BEGIN');const result=await callback(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
