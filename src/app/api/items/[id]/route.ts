import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { positiveVnd,assertText } from '@/lib/rental';
import { validProductImageUrl } from '@/lib/cloudinary-images';
import {rentalKind} from '@/lib/hourly-pricing';
import {isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import {normalizedAngles} from '@/lib/inspection-proof';
import {DEFAULT_PRODUCT_SIZE,launderingForCategory,isNonLaundryCategory} from '@/lib/product-policies';
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
        let value=0;let status='';
    if(updatingValue)value=positiveVnd(b.replacementValue,'Giá trị đền bù');
    else if(cleaned)status='AVAILABLE';
    else if(editing){}
    else {
      status=String(b.status);
      if(!['AVAILABLE','MAINTENANCE'].includes(status))throw new ApiError(400,'Trạng thái kho không hợp lệ.');
    }
    const ref=db().collection('items').doc(id);
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(!updatingValue&&!editing&&snap.data()?.status==='RENTED')throw new ApiError(409,'Đồ đang cho thuê, chưa thể đổi trạng thái.');
      if(cleaned&&snap.data()?.status!=='LAUNDRY')throw new ApiError(409,'Chỉ xác nhận đã giặt khi sản phẩm đang giặt.');
      if(!updatingValue&&!cleaned&&!editing&&snap.data()?.status==='LAUNDRY')throw new ApiError(409,'Đồ đang giặt: phải dùng nút Đã giặt để đưa vào kho.');
      if(snap.data()?.archivedAt)throw new ApiError(409,'Sản phẩm đã được lưu trữ, không còn được chỉnh sửa.');
      let patch:Record<string,unknown>;
      if(editing){
        const name=assertText(b.name,'Tên sản phẩm',120);
        const category=assertText(b.category,'Danh mục',50);
        const size=DEFAULT_PRODUCT_SIZE;
        const color=assertText(b.color??'','Màu sắc',40,false);
        const camera=isCameraCategory(category);
        if(camera&&me.role!=='admin')throw new ApiError(403,'Chỉ Admin được chỉnh máy ảnh.');
        if(Boolean(snap.data()?.cameraModel)!==camera)throw new ApiError(409,'Không đổi sản phẩm thường thành máy ảnh hoặc ngược lại. Hãy tạo một sản phẩm máy ảnh riêng.');
        if(camera&&(!isCameraModel(b.cameraModel)||b.cameraModel!==snap.data()?.cameraModel||b.cameraSerial!==snap.data()?.cameraSerial))throw new ApiError(409,'Model và serial đã gắn cố định với mã sản phẩm.');
        const dailyRate=camera?0:rentalKind(category)==='ACCESSORY'?20000:50000;
        if(!isNonLaundryCategory(category)&&typeof b.requiresLaundry!=='boolean')throw new ApiError(400,'Vui lòng xác nhận việc giặt với trang phục.');
        const requiresLaundry=launderingForCategory(category,b.requiresLaundry===true);
        if(!Array.isArray(b.imagePaths)||b.imagePaths.length>5||b.imagePaths.some((url:unknown)=>typeof url!=='string'||!(snap.data()?.imagePaths||[]).includes(url)&&!validProductImageUrl(url,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh sản phẩm không hợp lệ.');
        patch={name,category,size,color,dailyRate,requiresLaundry,imagePaths:b.imagePaths,bufferDays:0};
        if(me.role==='admin'){const rawAngles=b.inspectionAngles??snap.data()?.inspectionAngles??[];const angles=Array.isArray(rawAngles)&&rawAngles.length?normalizedAngles(rawAngles):[];patch.inspectionAngles=angles;
          const referenceShots=b.referenceShots??snap.data()?.referenceShots??{};
          if(typeof referenceShots!=='object'||Array.isArray(referenceShots)||Object.entries(referenceShots as Record<string,unknown>).some(([angle,url])=>!angles.includes(angle)||!(Object.values(snap.data()?.referenceShots||{}).includes(url)||validProductImageUrl(url,me.uid,process.env.CLOUDINARY_CLOUD_NAME||''))))throw new ApiError(400,'Ảnh chuẩn góc chụp không hợp lệ.');
          patch.referenceShots=referenceShots;
        }
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
    const hourly=await db().collection('v5DayIntervals').where('itemId','==',id).limit(5).get();
    if(hourly.docs.some(d=>(d.data()?.entries||[]).length))throw new ApiError(409,'Sản phẩm đã được đặt lịch theo giờ.');
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
