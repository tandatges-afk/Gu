import 'server-only';
import {randomBytes,createHmac,timingSafeEqual,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {pgPool,initializeSchema} from './pg-firestore';
const scrypt=promisify(scryptCallback);
const TTL=12*60*60;
const MAX_ATTEMPTS=10;
const cookieName='gu_session';
export const SESSION_COOKIE=cookieName;
function key():Buffer{const v=process.env.GU_SESSION_SECRET||'';if(v.length<32||v.includes('REPLACE_WITH'))throw Error('GU_SESSION_SECRET phải dài tối thiểu 32 ký tự ngẫu nhiên');return Buffer.from(v);}
function sign(payload:string){return createHmac('sha256',key()).update(payload).digest('base64url');}
export function sessionToken(uid:string,when=Math.floor(Date.now()/1000)){
 const p=Buffer.from(JSON.stringify({uid,iat:when,exp:when+TTL})).toString('base64url');return `${p}.${sign(p)}`;
}
export async function verifyToken(token:string){
 if(token.length>4096)throw Error('Invalid session');
 const [p,s,extra]=token.split('.');if(!p||!s||extra||s.length!==sign(p).length||!timingSafeEqual(Buffer.from(s),Buffer.from(sign(p))))throw Error('Invalid session');
 const data=JSON.parse(Buffer.from(p,'base64url').toString('utf8')) as {uid:string;iat:number;exp:number};
 const now=Math.floor(Date.now()/1000);
 if(!data.uid||!Number.isFinite(data.iat)||!Number.isFinite(data.exp)||now>data.exp||data.iat>now+60)throw Error('Session expired');
 await initializeSchema();
 const res=await pgPool().query('SELECT uid,email,name,disabled,revoked_after FROM gu_accounts WHERE uid=$1',[data.uid]);
 const u=res.rows[0];if(!u||u.disabled||u.revoked_after&&data.iat*1000<=new Date(u.revoked_after).getTime())throw Error('User disabled');
 return {uid:u.uid,email:u.email,name:u.name,auth_time:data.iat,exp:data.exp};
}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${hash.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){
 const [scheme,salt,expected]=stored.split(':');if(scheme!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(expected||''))return false;
 const got=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(Buffer.from(expected,'hex'),got);
}
export async function authenticate(email:string,password:string){
 await initializeSchema();const normalized=email.trim().toLowerCase();
 const rate=await pgPool().query('SELECT failures,first_failure_at FROM gu_login_attempts WHERE email=$1',[normalized]);
 if(rate.rows[0]?.failures>=MAX_ATTEMPTS&&Date.now()-new Date(rate.rows[0].first_failure_at).getTime()<15*60_000)throw Error('Too many attempts');
 const r=await pgPool().query('SELECT * FROM gu_accounts WHERE email=$1',[normalized]);
 const acc=r.rows[0];
 // Perform a scrypt hash even on unknown users to minimize account enumeration.
 const fallback='scrypt:00000000000000000000000000000000:'+('00'.repeat(64));
 const matched=await verifyPassword(password,acc?.password_hash||fallback);
 if(!matched||!acc||acc.disabled){
  await pgPool().query(`INSERT INTO gu_login_attempts(email,failures,first_failure_at) VALUES($1,1,now())
   ON CONFLICT(email) DO UPDATE SET failures=CASE WHEN gu_login_attempts.first_failure_at < now()-interval '15 minutes' THEN 1 ELSE gu_login_attempts.failures+1 END,
   first_failure_at=CASE WHEN gu_login_attempts.first_failure_at < now()-interval '15 minutes' THEN now() ELSE gu_login_attempts.first_failure_at END`,[normalized]);
  throw Error('Email hoặc mật khẩu không đúng.');
 }
 await pgPool().query('DELETE FROM gu_login_attempts WHERE email=$1',[normalized]);
 return {uid:acc.uid,email:acc.email,name:acc.name,token:sessionToken(acc.uid)};
}
export function serverAuth(){return {
 verifyIdToken:async(token:string,_checkRevoked=true)=>verifyToken(token),
 createUser:async({email,password,displayName,disabled=false}:{email:string;password:string;displayName?:string;disabled?:boolean})=>{
  if(password.length<12)throw Error('Password too short');await initializeSchema();const uid=randomBytes(16).toString('hex');const hashed=await hashPassword(password);
  try{await pgPool().query('INSERT INTO gu_accounts(uid,email,name,password_hash,disabled) VALUES($1,$2,$3,$4,$5)',[uid,email.toLowerCase(),displayName||'',hashed,disabled]);}
  catch(e){if((e as {code?:string}).code==='23505'){const err=new Error('Email exists') as Error&{code?:string};err.code='auth/email-already-exists';throw err;}throw e;}
  return {uid,email};
 },
 updateUser:async(uid:string,opts:{disabled?:boolean})=>{
  await pgPool().query('UPDATE gu_accounts SET disabled=$2,revoked_after=CASE WHEN $2 THEN now() ELSE revoked_after END WHERE uid=$1',[uid,opts.disabled]);
 },
 deleteUser:async(uid:string)=>{await pgPool().query('DELETE FROM gu_accounts WHERE uid=$1',[uid]);},
 revokeRefreshTokens:async(uid:string)=>{await pgPool().query('UPDATE gu_accounts SET revoked_after=now() WHERE uid=$1',[uid]);}
};}
