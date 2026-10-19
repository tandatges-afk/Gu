import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError,requirePcStaff} from '@/lib/http';
import {localDateTimeToISO,billableBlocks,vnDayKey} from '@/lib/hourly-pricing';
import {rentalCharge,cameraPackageSnapshot,isCameraCategory,isCameraModel} from '@/lib/camera-rental';
import {intervalRefs,checkIntervalAvailability,createIntervalWrites,simpleId} from '@/lib/v5-server';
import {normalizedAngles} from '@/lib/inspection-proof';
import {auditInTransaction} from '@/lib/audit';
import {syncDebtIndex} from '@/lib/debt-index';
import type {RentalOrder,InventoryItem,Customer,RentalLine} from '@/lib/types';
export const runtime='nodejs';export const preferredRegion='sin1';
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requirePcStaff(me);
  const b=await jsonBody(req);
  if(!simpleId(String(b.customerId||'')))throw new ApiError(400,'Chọn khách hàng hợp lệ.');
  const ids=b.itemIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(x=>typeof x!=='string'||!simpleId(x))||new Set(ids).size!==ids.length)throw new ApiError(400,'Chọn từ 1 đến 12 sản phẩm không trùng nhau.');
  const pickupAt=localDateTimeToISO(String(b.pickupAt||''));const returnAt=localDateTimeToISO(String(b.returnAt||''));
  const blocks=billableBlocks(pickupAt,returnAt);
  if(Date.parse(pickupAt)<Date.now()-5*60_000)throw new ApiError(400,'Không tạo lịch nhận trong quá khứ.');
  if(Date.parse(pickupAt)>Date.now()+365*86_400_000)throw new ApiError(400,'Chỉ đặt lịch trong 365 ngày tới.');
  const note=typeof b.note==='string'?b.note.slice(0,500):'';
  const customerRef=db().collection('customers').doc(String(b.customerId));
  const itemRefs=(ids as string[]).map(x=>db().collection('items').doc(x));
  const orderRef=db().collection('orders').doc();const jobRef=db().collection('mobileJobs').doc(orderRef.id);
  const slots=intervalRefs(ids as string[],pickupAt,returnAt);
  const now=new Date().toISOString();
  const result=await db().runTransaction(async tx=>{
   const [customerSnap,...itemSnaps]=await Promise.all([tx.get(customerRef),...itemRefs.map(x=>tx.get(x))]);
   if(!customerSnap.exists||itemSnaps.some(x=>!x.exists))throw new ApiError(404,'Không tìm thấy khách hoặc sản phẩm.');
   const customer={id:customerSnap.id,...customerSnap.data()} as Customer;
   const items=itemSnaps.map(s=>({id:s.id,...s.data()} as InventoryItem));
   if(items.some(i=>i.archivedAt||['MAINTENANCE','MISSING'].includes(i.status)))throw new ApiError(409,'Có sản phẩm đã ngưng sử dụng hoặc thất lạc.');
   if(items.some(i=>!Array.isArray(i.inspectionAngles)||!i.inspectionAngles.length))throw new ApiError(409,'Admin cần thêm góc ảnh giao/nhận cho từng sản phẩm trước khi tạo đơn.');
   const snapshots=await checkIntervalAvailability(tx,slots);
   const lines:RentalLine[]=items.map(i=>({itemId:i.id,name:i.name,sku:i.sku,hangerCode:i.hangerCode,size:i.size,category:i.category,cameraModel:i.cameraModel,cameraSerial:i.cameraSerial,...(isCameraCategory(i.category)&&isCameraModel(i.cameraModel)?cameraPackageSnapshot(i.cameraModel,pickupAt,returnAt):{}),dailyRate:i.dailyRate,bufferDays:0,replacementValue:i.replacementValue,lineTotal:rentalCharge(i,pickupAt,returnAt),startDate:vnDayKey(pickupAt),startAt:pickupAt}));
   const total=lines.reduce((s,l)=>s+l.lineTotal,0);
   const code='TH-'+now.slice(2,10).replace(/-/g,'')+'-'+orderRef.id.slice(0,5).toUpperCase();
   // Snapshot only validated/normalized angle labels. InventoryItem.inspectionAngles is optional
   // for legacy records, but a new v5 order must persist a complete string[] per item.
   const photoTemplates:Record<string,string[]>={};
   for(const item of items){
    try{photoTemplates[item.id]=normalizedAngles(item.inspectionAngles);}
    catch{throw new ApiError(409,`Góc chụp của sản phẩm “${item.name}” không hợp lệ. Admin cần kiểm tra lại.`);}
   }
   const referencePhotos=Object.fromEntries(items.map(i=>[i.id,i.referenceShots||{}]));
   const record:Omit<RentalOrder,'id'>={code,customerId:customer.id,customerName:customer.name,customerPhone:customer.phone,pickupDate:vnDayKey(pickupAt),returnDate:vnDayKey(returnAt),pickupAt,returnAt,pricingVersion:'GU_HOURLY_V1',photoTemplates,referencePhotos,rentalDays:blocks,lines,total,paid:0,depositDue:0,note,status:'RESERVED',createdAt:now,updatedAt:now,createdBy:me.uid,createdByName:me.name,history:[{action:'CREATE_HOURLY',at:now,by:me.uid,detail:'Đơn đã được tạo, chụp ảnh tại màn giao hàng của nhân viên'}]};
   tx.create(orderRef,record);createIntervalWrites(tx,slots,snapshots,orderRef.id);
   tx.create(jobRef,{orderId:orderRef.id,code,customerName:customer.name,pickupAt,returnAt,stage:'HANDOVER',createdAt:now,updatedAt:now,creatorName:me.name});
   syncDebtIndex(tx,db(),{id:orderRef.id,...record});auditInTransaction(tx,me,'V5_ORDER_CREATE','order',orderRef.id,`${code} / ${items.length} sản phẩm, ${blocks} chu kỳ`);
   return {id:orderRef.id,...record};
  });
  return NextResponse.json(result,{status:201});
 }catch(e){return handleError(e);}
}
