import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { positiveVnd,assertText } from '@/lib/rental';
import { validProductImageUrl } from '@/lib/cloudinary-images';
import { auditInTransaction } from '@/lib/audit';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try{
    const me=await staffUser(req);
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã sản phẩm không hợp lệ.');
    const b=await jsonBody(req);
    if(me.role!=='admin' && !['CLEAN','EDIT'].includes(String(b.action)))throw new ApiError(403,'Chỉ Admin được định giá hoặc đổi tình trạng kho.');
    const updatingValue=b.action==='SET_VALUE';
    const cleaned=b.action==='CLEAN';
    const editing=b.action==='EDIT';
    const setBuffer=false; // buffer-day editor retired
    let value=0;let status='';
    if(updatingValue)value=positiveVnd(b.replacementValue,'Giá trị đền bù');
    else if(cleaned)status='AVAILABLE';
    else if(editing){}
    else {
      status=String(b.status);
      if(!['AVAILABLE','LAUNDRY','MAINTENANCE'].includes(status))throw new ApiError(400,'Trạng thái kho không hợp lệ.');
    }
    const ref=db().collection('items').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(!updatingValue&&!editing&&snap.data()?.status==='RENTED')throw new ApiError(409,'Đồ đang cho thuê, chưa thể đổi trạng thái.');
      if(cleaned&&snap.data()?.status!=='LAUNDRY')throw new ApiError(409,'Chỉ xác nhận đã giặt khi món đồ đang chờ giặt.');
      if(!updatingValue&&!cleaned&&!editing&&snap.data()?.status==='LAUNDRY')throw new ApiError(409,'Đồ đang chờ giặt: phải dùng nút Đã giặt để đưa vào kho.');
      if(snap.data()?.archivedAt)throw new ApiError(409,'Sản phẩm đã được lưu trữ, không còn được chỉnh sửa.');
      let patch:Record<string,unknown>;
      if(editing){
        const name=assertText(b.name,'Tên sản phẩm',120);
        const category=assertText(b.category,'Danh mục',50);
        const size=assertText(b.size,'Size',30);
        const color=assertText(b.color??'','Màu sắc',40,false);
        const dailyRate=positiveVnd(b.dailyRate,'Giá thuê/ngày');
        if(typeof b.requiresLaundry!=='boolean')throw new ApiError(400,'Vui lòng xác nhận yêu cầu giặt.');
        if(!Array.isArray(b.imagePaths)||b.imagePaths.length>5||b.imagePaths.some((url:unknown)=>typeof url!=='string'||!(snap.data()?.imagePaths||[]).includes(url)&&!validProductImageUrl(url,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh sản phẩm không hợp lệ.');
        patch={name,category,size,color,dailyRate,requiresLaundry:b.requiresLaundry,imagePaths:b.imagePaths,bufferDays:0};
        if(me.role==='admin' && b.replacementValue!==undefined)patch.replacementValue=positiveVnd(b.replacementValue,'Giá trị đền bù');
      }else if(updatingValue)patch={replacementValue:value};
      else if(cleaned)patch={status:'AVAILABLE',laundryCompletedAt:new Date().toISOString()};
      else {
        if(snap.data()?.status==='MISSING')throw new ApiError(409,'Đồ thất lạc không thể tự chuyển tình trạng. Admin cần xử lý thu hồi riêng.');
        patch={status};
      }
      tx.update(ref,patch);
      auditInTransaction(tx,me,editing?'ITEM_EDIT':updatingValue?'ITEM_VALUE':cleaned?'ITEM_CLEANED':'ITEM_STATUS','item',id,
        editing?`Chỉnh sửa ${snap.data()?.name}`:updatingValue?`Admin định giá ${snap.data()?.name}: ${value} VND`:`${snap.data()?.name}: ${snap.data()?.status} → ${status}`);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}

/** Soft-delete retains references in historical orders and audits. Never erase a booked item. */
export async function DELETE(req:NextRequest,ctx:{params:Promise<{id:string}>}){
  try{
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được lưu trữ sản phẩm.');
    const {id}=await ctx.params;
    if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Mã sản phẩm không hợp lệ.');
    const ref=db().collection('items').doc(id);
    // Lock entries are persisted for every active reserved/picked-up order.
    const locks=await db().collection('rentalSlots').where('itemId','==',id).limit(1).get();
    if(!locks.empty)throw new ApiError(409,'Không thể xóa sản phẩm đang có lịch giữ hoặc chưa trả.');
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(snap.data()?.archivedAt)throw new ApiError(409,'Sản phẩm đã được lưu trữ.');
      if(snap.data()?.status!=='AVAILABLE' && snap.data()?.status!=='MAINTENANCE')throw new ApiError(409,'Chỉ được lưu trữ đồ rảnh hoặc bảo trì; đồ thuê, giặt, thất lạc phải xử lý trước.');
      const now=new Date().toISOString();
      tx.update(ref,{archivedAt:now});
      auditInTransaction(tx,me,'ITEM_ARCHIVE','item',id,`Lưu trữ ${snap.data()?.name}; giữ nguyên dữ liệu đơn cũ`,now);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
