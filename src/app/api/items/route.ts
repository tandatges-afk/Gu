import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser,handleError,jsonBody,ApiError } from '@/lib/http';
import { assertText,positiveVnd } from '@/lib/rental';
import { auditInTransaction } from '@/lib/audit';
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
    const dailyRate=positiveVnd(b.dailyRate,'Giá thuê/ngày');
    // No selectable buffer: availability is determined by actual reservations and laundry status.
    if(!Array.isArray(b.imagePaths)||b.imagePaths.length>5||b.imagePaths.some(p=>!validProductImageUrl(p,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh phải được tải lên từ tài khoản của bạn (tối đa 5 ảnh).');
    if(typeof b.requiresLaundry!=='boolean')throw new ApiError(400,'Vui lòng chọn sản phẩm có cần giặt sau thuê hay không.');
    const replacementValue=me.role==='admin'?positiveVnd(b.replacementValue,'Giá trị đền bù'):0;
    const skuRef=db().collection('skuIndex').doc(encodeURIComponent(sku));
    const counterRef=db().collection('inventoryCounters').doc(HANGER_COUNTER_DOC);
    const now=new Date().toISOString();
    const item={name,sku,size,color,category,dailyRate,bufferDays:0,requiresLaundry:b.requiresLaundry as boolean,replacementValue,imagePaths:b.imagePaths as string[],status:'AVAILABLE',createdAt:now,createdBy:me.uid};
    const hangerCode=await db().runTransaction(async tx=>{
      // All reads precede all writes; increment is atomic even when two employees create simultaneously.
      const [exists,counter]=await Promise.all([tx.get(skuRef),tx.get(counterRef)]);
      if(exists.exists)throw new ApiError(409,'Sản phẩm đã tồn tại.');
      const sequence=nextHangerSequence(counter.data()?.value);
      const code=formatHangerCode(sequence);
      tx.set(counterRef,{value:sequence,updatedAt:now});
      tx.create(skuRef,{itemId:ref.id});tx.create(ref,{...item,hangerCode:code});
      auditInTransaction(tx,me,'ITEM_CREATE','item',ref.id,`${code} - ${name}, ${item.imagePaths.length} ảnh`,now);
      return code;
    });
    return NextResponse.json({id:ref.id,...item,hangerCode},{status:201});
  }catch(e){return handleError(e);}
}
