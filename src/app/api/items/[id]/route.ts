import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { positiveVnd } from '@/lib/rental';
import { auditInTransaction } from '@/lib/audit';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try{
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được định giá hoặc đổi tình trạng kho.');
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã sản phẩm không hợp lệ.');
    const b=await jsonBody(req);
    const updatingValue=b.action==='SET_VALUE';
    let value=0;let status='';
    if(updatingValue)value=positiveVnd(b.replacementValue,'Giá trị đền bù');
    else {
      status=String(b.status);
      if(!['AVAILABLE','LAUNDRY','MAINTENANCE'].includes(status))throw new ApiError(400,'Trạng thái kho không hợp lệ.');
    }
    const ref=db().collection('items').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(!updatingValue&&snap.data()?.status==='RENTED')throw new ApiError(409,'Đồ đang cho thuê, chưa thể đổi trạng thái.');
      tx.update(ref,updatingValue?{replacementValue:value}:{status});
      auditInTransaction(tx,me,updatingValue?'ITEM_VALUE':'ITEM_STATUS','item',id,
        updatingValue?`Admin định giá ${snap.data()?.sku}: ${value} VND`:`${snap.data()?.sku}: ${snap.data()?.status} → ${status}`);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
