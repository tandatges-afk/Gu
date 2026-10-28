import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {assertText,positiveVnd} from '@/lib/rental';
import {normalizeProductName,productNameIndexId,PRODUCT_NAME_INDEX_MIGRATION} from '@/lib/product-name';
import {MAX_BULK_ITEMS,validateBulkNames} from '@/lib/bulk-inventory-rules';
import {productSearchBigrams} from '@/lib/product-search';
import {isCameraCategory,isCameraModel,normalizedSerial} from '@/lib/camera-rental';
import {rentalKind} from '@/lib/hourly-pricing';
import {normalizedAngles} from '@/lib/inspection-proof';
import {DEFAULT_PRODUCT_SIZE,launderingForCategory,isNonLaundryCategory} from '@/lib/product-policies';
import {validProductImageUrl} from '@/lib/cloudinary-images';
import {validVisualIndexEntries} from '@/lib/visual-index';
import {HANGER_COUNTER_DOC,nextHangerSequence,formatHangerCode,HANGER_LIMIT} from '@/lib/hanger-code';
import {auditInTransaction} from '@/lib/audit';

export const runtime='nodejs';
type BulkInput={name:string;category:string;color:string;requiresLaundry:boolean;replacementValue:number;imagePaths:string[];inspectionAngles:string[];cameraModel?:string;cameraSerial?:string;referenceShots?:Record<string,string>};

export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  const body=await jsonBody(req,256_000);
  if(body.action==='check'){
   if(!Array.isArray(body.names)||body.names.length>MAX_BULK_ITEMS||body.names.some(n=>typeof n!=='string'||n.length>120))throw new ApiError(400,'Danh sách tên không hợp lệ.');
   const names=body.names as string[];
   const issues=validateBulkNames(names);
   const migration=await db().collection('systemMigrations').doc(PRODUCT_NAME_INDEX_MIGRATION).get();
   if(migration.data()?.completed!==true)throw new ApiError(409,'Cần đồng bộ chỉ mục tên sản phẩm trước khi nhập kho.');
   const result=await Promise.all(names.map(async name=>{
    if(!normalizeProductName(name))return false;
    return (await db().collection('productNameIndex').doc(productNameIndexId(name)).get()).exists;
   }));
   return NextResponse.json({issues:[...issues,...result.flatMap((found,row)=>found?[{row,code:'EXISTING',message:'Tên sản phẩm đã có trong kho.'}]:[])]},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action!=='save'||!Array.isArray(body.items)||body.items.length<1||body.items.length>MAX_BULK_ITEMS)throw new ApiError(400,`Chọn từ 1 đến ${MAX_BULK_ITEMS} sản phẩm để lưu.`);
  if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))throw new ApiError(400,'Mã yêu cầu không hợp lệ.');
  const entries=body.items as unknown[];
  if(entries.some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw new ApiError(400,'Dữ liệu sản phẩm không hợp lệ.');
  const invalid=validateBulkNames(entries.map(v=>typeof (v as Record<string,unknown>).name==='string'?(v as {name:string}).name:''));
  if(invalid.length)throw new ApiError(409,`Dòng ${invalid[0].row+1}: ${invalid[0].message}`);
  const now=new Date().toISOString();
  const products=entries.map((value,i)=>{
   const input=value as Record<string,unknown>;
   try{
    const name=assertText(input.name,'Tên sản phẩm',120);
    const category=assertText(input.category,'Danh mục',50);
    const color=assertText(input.color,'Màu sắc',40,false);
    const camera=isCameraCategory(category);
    if(camera&&me.role!=='admin')throw new ApiError(403,'Chỉ Admin được thêm máy ảnh.');
    const cameraModel=camera&&isCameraModel(input.cameraModel)?input.cameraModel:undefined;
    if(camera&&!cameraModel)throw new ApiError(400,'Chọn mẫu Canon EOS R50 hoặc Canon M50.');
    const cameraSerial=camera?normalizedSerial(input.cameraSerial):undefined;
    if(!isNonLaundryCategory(category)&&typeof input.requiresLaundry!=='boolean')throw new ApiError(400,'Chọn chế độ giặt sau thuê.');
    const replacementValue=positiveVnd(input.replacementValue,'Giá trị đền bù');
    if(!Array.isArray(input.imagePaths)||input.imagePaths.length>5||input.imagePaths.some(p=>!validProductImageUrl(p,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh sản phẩm không hợp lệ (tối đa 5 ảnh từ tài khoản hiện tại).');
    const inspectionAngles=normalizedAngles(input.inspectionAngles);
    if(input.visualSignatures!==undefined&&(!validVisualIndexEntries(input.visualSignatures)||(input.visualSignatures as {imagePath:string}[]).some(entry=>!(input.imagePaths as string[]).includes(entry.imagePath))))throw new ApiError(400,'Chỉ mục tìm kiếm ảnh không hợp lệ.');
    const referenceShots=input.referenceShots&&typeof input.referenceShots==='object'&&!Array.isArray(input.referenceShots)?input.referenceShots as Record<string,unknown>:{};
    if(Object.entries(referenceShots).some(([angle,url])=>!inspectionAngles.includes(angle)||!validProductImageUrl(url,me.uid,process.env.CLOUDINARY_CLOUD_NAME||'')))throw new ApiError(400,'Ảnh mẫu theo góc không hợp lệ.');
    const ref=db().collection('items').doc();
    return {ref,...(input.visualSignatures?{visualSignatures:input.visualSignatures}:{}),name,nameKey:normalizeProductName(name),nameSearchBigrams:productSearchBigrams(name),sku:'GU-'+ref.id.slice(0,12).toUpperCase(),size:DEFAULT_PRODUCT_SIZE,color,category,...(camera?{cameraModel,cameraSerial}:{}),inspectionAngles,referenceShots,dailyRate:camera?0:rentalKind(category)==='ACCESSORY'?20000:50000,bufferDays:0,requiresLaundry:launderingForCategory(category,input.requiresLaundry===true),replacementValue,imagePaths:input.imagePaths as string[],status:'AVAILABLE',createdAt:now,createdBy:me.uid};
   }catch(error){if(error instanceof ApiError)throw new ApiError(error.status,`Dòng ${i+1}: ${error.message}`);throw new ApiError(400,`Dòng ${i+1}: ${error instanceof Error?error.message:'Thông tin không hợp lệ.'}`);}
  });
  const serials=products.flatMap(p=>('cameraSerial' in p&&p.cameraSerial)?[p.cameraSerial]:[]);
  if(new Set(serials).size!==serials.length)throw new ApiError(409,'Trùng số serial máy ảnh giữa các dòng.');
  const signature=createHash('sha256').update(JSON.stringify(entries.map(entry=>{const {visualSignatures:_,...core}=entry as Record<string,unknown>;return core;}))).digest('hex');
  const receipt=db().collection('bulkInventoryRequests').doc(`${me.uid}_${body.requestId}`);
  const counterRef=db().collection('inventoryCounters').doc(HANGER_COUNTER_DOC);
  const migrationRef=db().collection('systemMigrations').doc(PRODUCT_NAME_INDEX_MIGRATION);
  const nameRefs=products.map(p=>db().collection('productNameIndex').doc(productNameIndexId(p.name)));
  const skuRefs=products.map(p=>db().collection('skuIndex').doc(encodeURIComponent(p.sku)));
  const serialRefs=products.map(p=>('cameraSerial' in p&&p.cameraSerial)?db().collection('cameraSerialIndex').doc(p.cameraSerial):null);
  const result=await db().runTransaction(async tx=>{
   // The PG adapter acquires an advisory transaction lock. ALL reads happen before writes.
   const [previous,counter,migration]=await Promise.all([tx.get(receipt),tx.get(counterRef),tx.get(migrationRef)]);
   const checks=await Promise.all([
    ...nameRefs.map(ref=>tx.get(ref)),
    ...skuRefs.map(ref=>tx.get(ref)),
    ...serialRefs.map(ref=>ref?tx.get(ref):Promise.resolve(null))
   ]);
   if(previous.exists){
    if(previous.data()?.signature!==signature)throw new ApiError(409,'Mã yêu cầu đã dùng cho nội dung khác.');
    return previous.data().result as {created:number;items:{id:string;name:string;hangerCode:string}[]};
   }
   if(migration.data()?.completed!==true)throw new ApiError(409,'Cần hoàn tất đồng bộ tên sản phẩm trước khi nhập kho.');
   checks.forEach((snapshot,index)=>{if(snapshot?.exists){const row=index%products.length;throw new ApiError(409,`Dòng ${row+1}: ${index<products.length?'Tên sản phẩm đã tồn tại.':index<products.length*2?'Mã nội bộ trùng.':'Serial máy ảnh đã tồn tại.'}`);}});
   const initial=counter.data()?.value;
   let sequence=initial===undefined||initial===null?0:Number(initial);
   if(!Number.isSafeInteger(sequence)||sequence<0||sequence+products.length>HANGER_LIMIT)throw new ApiError(409,'Kho đã hết mã sản phẩm hoặc bộ đếm không hợp lệ.');
   const created=products.map(p=>{sequence=nextHangerSequence(sequence);return {id:p.ref.id,name:p.name,hangerCode:formatHangerCode(sequence)};});
   tx.set(counterRef,{value:sequence,updatedAt:now});
   products.forEach((p,i)=>{
    const code=created[i].hangerCode;
    tx.create(nameRefs[i],{key:p.nameKey,name:p.name,owners:[p.ref.id],updatedAt:now});
    tx.create(skuRefs[i],{itemId:p.ref.id});
    if(serialRefs[i])tx.create(serialRefs[i]!,{itemId:p.ref.id,model:'cameraModel' in p?p.cameraModel:undefined});
    tx.create(p.ref,{...p,hangerCode:code});
    auditInTransaction(tx,me,'ITEM_CREATE','item',p.ref.id,`${code} - ${p.name}, nhập kho hàng loạt`,now);
   });
   const response={created:created.length,items:created};
   tx.create(receipt,{actorUid:me.uid,signature,result:response,createdAt:now});
   return response;
  });
  return NextResponse.json(result,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return handleError(error,'items/bulk');}
}
