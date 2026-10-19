import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { assertText,positiveVnd } from '@/lib/rental';
import {rentalKind} from '@/lib/hourly-pricing';
import {isCameraCategory,isCameraModel,normalizedSerial} from '@/lib/camera-rental';
import {normalizedAngles,DEFAULT_ANGLES} from '@/lib/inspection-proof';
import {auditInTransaction } from '@/lib/audit';
import { validProductImageUrl } from '@/lib/cloudinary-images';
import { HANGER_COUNTER_DOC, nextHangerSequence, formatHangerCode } from '@/lib/hanger-code';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function POST(req:NextRequest) {
  try{
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const name=assertText(b.name,'Tên sản phẩm',120);
    // SKU is an internal immutable identifier. Employees never enter it.
    const ref=db().collection('items').doc();
    const sku='GU-'+ref.id.slice(0,12).toUpperCase();
    const size=assertText(b.size,'Size',30);
    const color=assertText(b.color,'Màu sắc',40,false);
    const category=assertText(b.category,'Loại sản phẩm',50);
    const camera=isCameraCategory(category);
    if(camera&&me.role!=='admin')throw new ApiError(403,'Chỉ Admin được nhập máy ảnh và xác minh số serial.');
    const cameraModel=camera&&isCameraModel(b.cameraModel)?b.cameraModel:undefined;
    if(camera&&!cameraModel)throw new ApiError(400,'Chọn mẫu máy Canon EOS R50 hoặc Canon M50.');
    const cameraSerial=camera?normalizedSerial(b.cameraSerial):undefined;
    const serialRef=cameraSerial?db().collection('cameraSerialIndex').doc(cameraSerial):null;
    const dailyRate=camera?0:rentalKind(category)==='ACCESSORY'?20000:50000;
    // No selectable buffer: availability is determined by actual reservations and laundry status.
    if(!Array.isArray(b.imagePaths)||b.imagePaths.length>5||b.imagePaths.some(p=>!validProductImageUrl(p,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh phải được tải lên từ tài khoản của bạn (tối đa 5 ảnh).');
    if(typeof b.requiresLaundry!=='boolean')throw new ApiError(400,'Vui lòng chọn sản phẩm có cần giặt sau thuê hay không.');
    if(camera&&b.requiresLaundry)throw new ApiError(400,'Máy ảnh không có quy trình giặt; chỉ kiểm tra, vệ sinh thiết bị.');
    const replacementValue=me.role==='admin'?positiveVnd(b.replacementValue,'Giá trị đền bù'):0;
    const skuRef=db().collection('skuIndex').doc(encodeURIComponent(sku));
    const counterRef=db().collection('inventoryCounters').doc(HANGER_COUNTER_DOC);
    const now=new Date().toISOString();
    const inspectionAngles=me.role==='admin'&&b.inspectionAngles?normalizedAngles(b.inspectionAngles):DEFAULT_ANGLES;
    const referenceShots=me.role==='admin'&&b.referenceShots&&typeof b.referenceShots==='object'&&!Array.isArray(b.referenceShots)?b.referenceShots as Record<string,unknown>:{};
    if(Object.entries(referenceShots).some(([angle,url])=>!inspectionAngles.includes(angle)||!validProductImageUrl(url,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh chi tiết phải nằm trong góc chụp và được tải lên từ tài khoản Admin.');
    const item={name,sku,size,color,category,...(camera?{cameraModel,cameraSerial}:{}),inspectionAngles,referenceShots,dailyRate,bufferDays:0,requiresLaundry:b.requiresLaundry as boolean,replacementValue,imagePaths:b.imagePaths as string[],status:'AVAILABLE',createdAt:now,createdBy:me.uid};
    const hangerCode=await db().runTransaction(async tx=>{
      // All reads precede all writes; increment is atomic even when two employees create simultaneously.
      const [exists,counter,serial]=await Promise.all([tx.get(skuRef),tx.get(counterRef),serialRef?tx.get(serialRef):Promise.resolve(null)]);
      if(exists.exists)throw new ApiError(409,'Sản phẩm đã tồn tại.');
      if(serial?.exists)throw new ApiError(409,'Serial máy ảnh đã được đăng ký cho sản phẩm khác.');
      const sequence=nextHangerSequence(counter.data()?.value);
      const code=formatHangerCode(sequence);
      tx.set(counterRef,{value:sequence,updatedAt:now});
      tx.create(skuRef,{itemId:ref.id});if(serialRef)tx.create(serialRef,{itemId:ref.id,model:cameraModel});tx.create(ref,{...item,hangerCode:code});
      auditInTransaction(tx,me,'ITEM_CREATE','item',ref.id,`${code} - ${name}, ${item.imagePaths.length} ảnh`,now);
      return code;
    });
    return NextResponse.json({id:ref.id,...item,hangerCode},{status:201});
  }catch(e){return handleError(e);}
}
