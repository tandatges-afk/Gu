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
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã sản phẩm không hợp lệ.');
    const b=await jsonBody(req);
    if(me.role!=='admin' && b.action!=='CLEAN')throw new ApiError(403,'Chỉ Admin được định giá hoặc đổi tình trạng kho.');
    const updatingValue=b.action==='SET_VALUE';
    const cleaned=b.action==='CLEAN';
    const setBuffer=b.action==='SET_BUFFER';
    let value=0;let status='';
    if(updatingValue)value=positiveVnd(b.replacementValue,'Giá trị đền bù');
    else if(cleaned)status='AVAILABLE';
    else if(setBuffer){if(!Number.isInteger(b.bufferDays)||![0,1,2].includes(Number(b.bufferDays)))throw new ApiError(400,'Ngày đệm phải là 0, 1 hoặc 2.');}
    else {
      status=String(b.status);
      if(!['AVAILABLE','LAUNDRY','MAINTENANCE'].includes(status))throw new ApiError(400,'Trạng thái kho không hợp lệ.');
    }
    const ref=db().collection('items').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(!updatingValue&&!setBuffer&&snap.data()?.status==='RENTED')throw new ApiError(409,'Đồ đang cho thuê, chưa thể đổi trạng thái.');
      if(cleaned&&snap.data()?.status!=='LAUNDRY')throw new ApiError(409,'Chỉ xác nhận đã giặt khi món đồ đang chờ giặt.');
      if(!updatingValue&&!cleaned&&!setBuffer&&snap.data()?.status==='LAUNDRY')throw new ApiError(409,'Đồ đang chờ giặt: phải dùng nút Đã giặt để đưa vào kho.');
      tx.update(ref,updatingValue?{replacementValue:value}:cleaned?{status:'AVAILABLE',laundryCompletedAt:new Date().toISOString()}:setBuffer?{bufferDays:Number(b.bufferDays),requiresLaundry:snap.data()?.requiresLaundry ?? (Number(snap.data()?.bufferDays||0)>0)}:{status});
      auditInTransaction(tx,me,updatingValue?'ITEM_VALUE':cleaned?'ITEM_CLEANED':setBuffer?'ITEM_BUFFER':'ITEM_STATUS','item',id,
        updatingValue?`Admin định giá ${snap.data()?.sku}: ${value} VND`:setBuffer?`${snap.data()?.sku}: ngày đệm ${snap.data()?.bufferDays} → ${b.bufferDays}`:`${snap.data()?.sku}: ${snap.data()?.status} → ${status}`);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
