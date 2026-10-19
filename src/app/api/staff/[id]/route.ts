import { NextRequest, NextResponse } from 'next/server';
import { db, serverAuth } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { auditInTransaction } from '@/lib/audit';
export const runtime='nodejs';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được quản lý tài khoản.');
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,128}$/.test(id))throw new ApiError(400,'UID không hợp lệ.');
    if(id===me.uid)throw new ApiError(409,'Không thể tự khóa tài khoản Admin của mình.');
    const b=await jsonBody(req);
    if(typeof b.disabled!=='boolean')throw new ApiError(400,'Trạng thái tài khoản không hợp lệ.');
    const ref=db().collection('staff').doc(id);
    // Auth switch first, then Firestore: staffUser and the upload API check the staff doc.
    const snap=await ref.get();
    if(!snap.exists)throw new ApiError(404,'Tài khoản không tồn tại.');
    if(!['staff','staff_mobile'].includes(String(snap.data()?.role)))throw new ApiError(403,'Không được thay đổi quyền Admin trong giao diện này.');
    await serverAuth().updateUser(id,{disabled:b.disabled});
    try {
      await db().runTransaction(async tx=>{
        const current=await tx.get(ref);
        if(!current.exists||!['staff','staff_mobile'].includes(String(current.data()?.role)))throw new ApiError(409,'Trạng thái tài khoản đã thay đổi.');
        tx.update(ref,{disabled:b.disabled});
        auditInTransaction(tx,me,b.disabled?'STAFF_DISABLE':'STAFF_ENABLE','staff',id,`${b.disabled?'Khóa':'Mở'} tài khoản ${snap.data()?.email||id}`);
      });
    }catch(e){ // Best-effort restore auth flag if the Firestore operation fails.
      try{await serverAuth().updateUser(id,{disabled:!b.disabled});}catch(error){console.error('Staff auth rollback failed',error);}
      throw e;
    }
    if(b.disabled)await serverAuth().revokeRefreshTokens(id);
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
