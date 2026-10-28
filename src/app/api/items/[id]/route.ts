import {validVisualSignature,validVisualIndexEntries} from '@/lib/visual-index';
import { NextRequest,NextResponse } from 'next/server';
import {productSearchBigrams} from '@/lib/product-search';
import {normalizeProductName,productNameIndexId,PRODUCT_NAME_INDEX_MIGRATION} from '@/lib/product-name';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { positiveVnd,assertText } from '@/lib/rental';
import { validProductImageUrl } from '@/lib/cloudinary-images';
import {rentalKind} from '@/lib/hourly-pricing';
import {isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import {normalizedAngles} from '@/lib/inspection-proof';
import {DEFAULT_PRODUCT_SIZE,launderingForCategory,isNonLaundryCategory} from '@/lib/product-policies';
import { auditInTransaction } from '@/lib/audit';
import {mayArchiveItem} from '@/lib/inventory-archive-rules';
export const runtime='nodejs';
const nameKeyChanged=(a:string,b:string)=>a!==b;

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
    // Read the previous name outside the transaction only to obtain reference IDs.
    // Every collision decision below uses fresh transactional snapshots.
    const previous=editing?await ref.get():null;
    if(editing&&!previous?.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
    const requestedName=editing?assertText(b.name,'Tên sản phẩm',120):'';
    const nextNameRef=editing?db().collection('productNameIndex').doc(productNameIndexId(requestedName)):null;
    const oldNameRef=editing?db().collection('productNameIndex').doc(productNameIndexId(String(previous?.data()?.name||''))):null;
    const migrationRef=editing?db().collection('systemMigrations').doc(PRODUCT_NAME_INDEX_MIGRATION):null;
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      const [existingName,newNameEntry,migration]=editing?await Promise.all([tx.get(oldNameRef!),tx.get(nextNameRef!),tx.get(migrationRef!)]):[null,null,null];
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(!updatingValue&&!editing&&snap.data()?.status==='RENTED')throw new ApiError(409,'Đồ đang cho thuê, chưa thể đổi trạng thái.');
      if(cleaned&&snap.data()?.status!=='LAUNDRY')throw new ApiError(409,'Chỉ xác nhận đã giặt khi sản phẩm đang giặt.');
      if(!updatingValue&&!cleaned&&!editing&&snap.data()?.status==='LAUNDRY')throw new ApiError(409,'Đồ đang giặt: phải dùng nút Đã giặt để đưa vào kho.');
      if(snap.data()?.archivedAt)throw new ApiError(409,'Sản phẩm đã được lưu trữ, không còn được chỉnh sửa.');
      let patch:Record<string,unknown>;
      if(editing){
        const name=requestedName;
        const nameKey=normalizeProductName(name);
        if(migration?.data()?.completed!==true)throw new ApiError(409,'Cần hoàn tất đồng bộ tên sản phẩm trước khi chỉnh sửa kho.');
        // A concurrent rename is retried as conflict rather than overwriting an index.
        if(productNameIndexId(String(snap.data()?.name||''))!==oldNameRef!.id)throw new ApiError(409,'Sản phẩm vừa được thay đổi. Tải lại trang.');
        const owners=Array.isArray(newNameEntry?.data()?.owners)?newNameEntry.data()!.owners as string[]:[];
        if(nextNameRef!.id!==oldNameRef!.id && (owners.some(owner=>owner!==id)||newNameEntry?.exists))throw new ApiError(409,'Tên sản phẩm đã tồn tại.');
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
        patch={name,nameKey,nameSearchBigrams:productSearchBigrams(name),category,size,color,dailyRate,requiresLaundry,imagePaths:b.imagePaths,bufferDays:0};
        if(b.visualSignatures!==undefined){if(!validVisualIndexEntries(b.visualSignatures)||(b.visualSignatures as {imagePath:string}[]).some(entry=>!(b.imagePaths as string[]).slice(0,5).includes(entry.imagePath)))throw new ApiError(400,'Chỉ mục nhiều ảnh không hợp lệ.');patch.visualSignatures=b.visualSignatures;}
        else{const old=validVisualIndexEntries(snap.data()?.visualSignatures)?snap.data()!.visualSignatures as {imagePath:string;signature:unknown}[]:[];patch.visualSignatures=old.filter(entry=>(b.imagePaths as string[]).slice(0,5).includes(entry.imagePath));}
        if(b.visualSignature!==undefined){if(!validVisualSignature(b.visualSignature))throw new ApiError(400,'Chỉ mục ảnh không hợp lệ.');patch.visualSignature=b.visualSignature;patch.visualImagePath=b.imagePaths[0]||'';}
        else if((b.imagePaths as string[])[0]!==snap.data()?.visualImagePath){patch.visualSignature=null;patch.visualImagePath=null;}
        {const rawAngles=b.inspectionAngles??snap.data()?.inspectionAngles??[];const angles=Array.isArray(rawAngles)&&rawAngles.length?normalizedAngles(rawAngles):[];patch.inspectionAngles=angles;
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
      if(editing&&nextNameRef&&oldNameRef&&nameKeyChanged(oldNameRef.id,nextNameRef.id)){
        const oldOwners=Array.isArray(existingName?.data()?.owners)?existingName!.data()!.owners as string[]:[];
        const survivors=oldOwners.filter(owner=>owner!==id);
        if(survivors.length)tx.set(oldNameRef,{...existingName!.data(),owners:survivors,updatedAt:new Date().toISOString()});
        else if(existingName?.exists)tx.delete(oldNameRef);
        tx.create(nextNameRef,{key:normalizeProductName(requestedName),name:requestedName,owners:[id],updatedAt:new Date().toISOString()});
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
    // All three checks MUST share the transaction's advisory lock with V5
    // order creation, extension, and pickup. Reading slots outside the lock
    // lets a concurrent reservation slip between the check and archive.
    await db().runTransaction(async tx=>{
      const [snap,legacyLocks,hourlyLocks]=await Promise.all([
        tx.get(ref),
        tx.get(db().collection('rentalSlots').where('itemId','==',id).limit(1)),
        // Never limit to the first five days: an older empty day may hide
        // an active reservation in a later row.
        tx.get(db().collection('v5DayIntervals').where('itemId','==',id)),
      ]);
      if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
      if(snap.data()?.archivedAt)throw new ApiError(409,'Sản phẩm đã được lưu trữ.');
      if(snap.data()?.status!=='AVAILABLE' && snap.data()?.status!=='MAINTENANCE')throw new ApiError(409,'Chỉ được lưu trữ đồ rảnh hoặc bảo trì; đồ thuê, giặt, thất lạc phải xử lý trước.');
      if(!mayArchiveItem(legacyLocks.size>0,hourlyLocks.docs.map(d=>d.data())))
        throw new ApiError(409,'Sản phẩm vẫn còn lịch đặt hoặc dữ liệu khóa lịch cần đối soát; chưa thể lưu trữ.');
      const now=new Date().toISOString();
      tx.update(ref,{archivedAt:now});
      auditInTransaction(tx,me,'ITEM_ARCHIVE','item',id,`Lưu trữ ${snap.data()?.name}; giữ nguyên dữ liệu đơn cũ`,now);
    });
    return NextResponse.json({ok:true});
  }catch(e){return handleError(e);}
}
