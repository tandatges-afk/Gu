import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { pgRows, pgTransaction } from '@/lib/pg-vps';
import { checkOrigin, jsonObject, needString, pgCurrentUser, pgError, pgTokenHash, SESSION_COOKIE, PgHttpError } from '@/lib/pg-security';

export const runtime='nodejs';

type CredentialRow = {id:string;password_hash:string;disabled:boolean};
const sessionAge = 60*60*8;
const cookieSettings = {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax' as const, path:'/',maxAge:sessionAge};

export async function GET(req:NextRequest) {
  try { return NextResponse.json({user:await pgCurrentUser(req)}, {headers:{'Cache-Control':'no-store'}}); }
  catch(e){return pgError(e);}
}
export async function POST(req:NextRequest) {
  try {
    checkOrigin(req);
    const body=await jsonObject(req);
    const email=needString(body.email,'Email',250).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new PgHttpError(400,'Email không hợp lệ.');
    const password=needString(body.password,'Mật khẩu',1000);
    const emailHash=createHash('sha256').update(email).digest('hex');
    const [attempts]=await pgRows<{count:string}>("SELECT count(*)::text AS count FROM auth_login_attempts WHERE email_hash=$1 AND attempted_at>now()-interval '15 minutes'",[emailHash]);
    if(Number(attempts?.count||0)>=8)throw new PgHttpError(429,'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.');
    const [user]=await pgRows<CredentialRow>('SELECT id,password_hash,disabled FROM staff_users WHERE lower(email)=$1 LIMIT 1',[email]);
    const valid=!!user&&!user.disabled&&await argon2.verify(user.password_hash,password).catch(()=>false);
    if(!valid){
      await pgRows('INSERT INTO auth_login_attempts(email_hash) VALUES($1) RETURNING id',[emailHash]);
      throw new PgHttpError(401,'Email hoặc mật khẩu không đúng.');
    }
    const token=randomBytes(32).toString('hex');
    await pgTransaction(async(client)=>{
      await client.query('INSERT INTO auth_sessions(staff_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'8 hours\')',[user.id,pgTokenHash(token)]);
      await client.query('DELETE FROM auth_login_attempts WHERE email_hash=$1',[emailHash]);
    });
    const response=NextResponse.json({ok:true});
    response.cookies.set(SESSION_COOKIE,token,cookieSettings);
    response.headers.set('Cache-Control','no-store');
    return response;
  }catch(e){return pgError(e);}
}
export async function DELETE(req:NextRequest) {
  try {
    checkOrigin(req);
    const token=req.cookies.get(SESSION_COOKIE)?.value;
    if(token && /^[a-f0-9]{64}$/.test(token))await pgRows('UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 RETURNING id',[pgTokenHash(token)]);
    const response=NextResponse.json({ok:true});
    response.cookies.set(SESSION_COOKIE,'',{...cookieSettings,maxAge:0});
    return response;
  }catch(e){return pgError(e);}
}
