import { NextRequest, NextResponse } from 'next/server';
import { serverAuth, db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText } from '@/lib/rental';
import { auditDoc } from '@/lib/audit';
import {pgPool,initializeSchema} from '@/lib/pg-firestore';
import {normalizeUsername,validUsername,validateNewPassword} from '@/lib/gu-username';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách nhân viên.');
    const snaps=await db().collection('staff').limit(200).get();
    await initializeSchema();
    const identities=await pgPool().query('SELECT uid,username FROM gu_accounts');
    const names=new Map<string,string>(identities.rows.map((r):[string,string]=>[String(r.uid),String(r.username||'')]));
    return NextResponse.json({staff:snaps.docs.map(d=>({uid:d.id,...d.data(),username:names.get(d.id)||d.data().username||''}))},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return handleError(e);}
}
export async function POST(req:NextRequest) {
  let createdUid: string|undefined;
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được tạo tài khoản nhân viên.');
    const b=await jsonBody(req);
    const name=assertText(b.name,'Họ tên',100);
    const username=normalizeUsername(assertText(b.username,'Tên đăng nhập',32));
    if(!validUsername(username))throw new ApiError(400,'Tên đăng nhập phải có 3–32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    const role='staff';
    const password=b.password;
    if(!validateNewPassword(password))throw new ApiError(400,'Mật khẩu ban đầu phải từ 6–128 ký tự.');
    // Only create STAFF here. Admin privileges must be provisioned securely by the owner.
    const account=await serverAuth().createUser({username,password,displayName:name,disabled:false});
    const uid=account.uid;createdUid=uid;
    const profile={name,username,email:account.email,role,disabled:false,createdAt:new Date().toISOString(),createdBy:me.uid};
    const audit=auditDoc(me,'STAFF_CREATE','staff',uid,`Cấp tài khoản ${username}`);
    const batch=db().batch();batch.create(db().collection('staff').doc(uid),profile);batch.create(audit.ref,audit.record);
    await batch.commit();
    return NextResponse.json({uid,...profile},{status:201});
  }catch(e){
    // Auth and Firestore are different services: best-effort rollback on failed Firestore commit.
    if(createdUid)try{await serverAuth().deleteUser(createdUid);}catch(error){console.error('Rollback staff user failed',error);}
    if(e&&typeof e==='object'&&'code' in e&&e.code==='auth/username-already-exists')return NextResponse.json({error:'Tên đăng nhập đã được sử dụng.'},{status:409});
    return handleError(e);
  }
}
