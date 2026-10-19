import { NextRequest, NextResponse } from 'next/server';
import { serverAuth, db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText } from '@/lib/rental';
import { auditDoc } from '@/lib/audit';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem danh sách nhân viên.');
    const snaps=await db().collection('staff').limit(200).get();
    return NextResponse.json({staff:snaps.docs.map(d=>({uid:d.id,...d.data()}))},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return handleError(e);}
}
export async function POST(req:NextRequest) {
  let createdUid: string|undefined;
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được tạo tài khoản nhân viên.');
    const b=await jsonBody(req);
    const name=assertText(b.name,'Họ tên',100);
    const email=assertText(b.email,'Email',200).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'Email không hợp lệ.');
    const role='staff';
    const password=b.password;
    if(typeof password!=='string'||password.length<12||password.length>128)throw new ApiError(400,'Mật khẩu ban đầu phải từ 12–128 ký tự.');
    // Only create STAFF here. Admin privileges must be provisioned securely by the owner.
    const account=await serverAuth().createUser({email,password,displayName:name,disabled:false});
    const uid=account.uid;createdUid=uid;
    const profile={name,email,role,disabled:false,createdAt:new Date().toISOString(),createdBy:me.uid};
    const audit=auditDoc(me,'STAFF_CREATE','staff',uid,`Cấp tài khoản ${email}`);
    const batch=db().batch();batch.create(db().collection('staff').doc(uid),profile);batch.create(audit.ref,audit.record);
    await batch.commit();
    return NextResponse.json({uid,...profile},{status:201});
  }catch(e){
    // Auth and Firestore are different services: best-effort rollback on failed Firestore commit.
    if(createdUid)try{await serverAuth().deleteUser(createdUid);}catch(error){console.error('Rollback staff user failed',error);}
    if(e&&typeof e==='object'&&'code' in e&&e.code==='auth/email-already-exists')return NextResponse.json({error:'Email đã được sử dụng.'},{status:409});
    return handleError(e);
  }
}
