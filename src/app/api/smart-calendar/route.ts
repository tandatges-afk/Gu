import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {addDays,vietnamToday} from '@/lib/rental';
import {findDayLocks} from '@/lib/interval-lookup';
import {cached,measureRoute,countQuery,countDoc} from '@/lib/read-optimization';
import {validateSmartRange} from '@/lib/smart-calendar';
import {localSearchRange,queryDays,occupiedInRange,type ExistingInterval} from '@/lib/hourly-availability';
import {productSearchText,matchesProductSearch} from '@/lib/product-search';
import type {InventoryItem} from '@/lib/types';
export const runtime='nodejs';export const preferredRegion='sin1';
const blocked=(i:InventoryItem,today:string)=>Boolean(i.archivedAt||['LAUNDRY','MAINTENANCE','MISSING'].includes(i.status)||!(i.replacementValue>0)||(i.status==='RENTED'&&(!i.expectedReturnDate||i.expectedReturnDate<today)));
async function getLocks(ids:string[],days:string[]){
 return cached('smart:locks:'+ids.slice().sort().join(',')+':'+days[0]+':'+days[days.length-1],20_000,()=>findDayLocks(ids,days));
}
export async function POST(req:NextRequest){return measureRoute('POST /api/smart-calendar',async()=>{
 try{
  await staffUser(req);const b=await jsonBody(req),today=vietnamToday();
  const start=String(b.pickupDate||''),end=String(b.returnDate||'');
  const rentalDays=validateSmartRange(start,end,today);
  if(rentalDays>30)throw new ApiError(400,'Tìm tối đa 30 ngày thuê.');
  const startHour=String(b.startHour||'09:00'),endHour=String(b.endHour||'09:00');
  const base=localSearchRange(start,end,startHour,endHour);
  const span=queryDays(base.from,base.to);
  if(b.mode==='FIND_AVAILABLE'){
   const q=String(b.query||'').trim().slice(0,80);const limit=40;
   let qry=db().collection('items').orderBy('name').limit(limit);
   if(q){const key=productSearchText(q);if(!key)throw new ApiError(400,'Từ khóa tìm kiếm không hợp lệ.');qry=db().collection('items').where('nameSearchBigrams','array-contains',key.length===1?key:key.slice(0,2)).limit(160);}
   const stock=countQuery(await qry.get());
   const candidates=stock.docs.map(d=>({id:d.id,...d.data()} as InventoryItem)).filter(item=>!blocked(item,today)&&(!q||matchesProductSearch([item.name,item.color,item.category,item.hangerCode||''].join(' '),q))).slice(0,limit);
   const locks=await getLocks(candidates.map(i=>i.id),span.map(x=>x.key));
   const free=candidates.filter(item=>span.every(d=>{const lock=locks.get(item.id+'|'+d.key);return !lock||!occupiedInRange(lock.legacy,lock.entries,d.start,d.end);}));
   return NextResponse.json({mode:'FIND_AVAILABLE',pickupDate:start,returnDate:end,startHour,endHour,availableIds:free.map(i=>i.id),products:free,checkedItems:stock.size,checkedAt:new Date().toISOString(),hasMore:stock.size>=(!q?limit:160)},
   {headers:{'Cache-Control':'private,no-store'}});
  }
  if(b.mode==='NEXT_AVAILABLE'){
   const id=String(b.itemId||'');if(!/^[\w-]{10,128}$/.test(id))throw new ApiError(400,'Sản phẩm không hợp lệ.');
   const snap=countDoc(await db().collection('items').doc(id).get());if(!snap.exists)throw new ApiError(404,'Không tìm thấy sản phẩm.');
   const item={id:snap.id,...snap.data()} as InventoryItem;
   if(blocked(item,today))return NextResponse.json({mode:'NEXT_AVAILABLE',itemId:id,nextPickupDate:null,nextReturnDate:null,reason:'Sản phẩm chưa sẵn sàng hoặc chưa được duyệt giá.'});
   const allDays=Array.from({length:90+rentalDays+2},(_,i)=>addDays(start,i));
   const locks=await getLocks([id],allDays);
   for(let n=0;n<=90;n++){
    const fromDay=addDays(start,n),toDay=addDays(end,n);
    const range=localSearchRange(fromDay,toDay,startHour,endHour);
    const overlaps=queryDays(range.from,range.to).some(d=>{const lock=locks.get(id+'|'+d.key);return Boolean(lock&&occupiedInRange(lock.legacy,lock.entries,d.start,d.end));});
    if(!overlaps)return NextResponse.json({mode:'NEXT_AVAILABLE',itemId:id,nextPickupDate:fromDay,nextReturnDate:toDay,reason:''},{headers:{'Cache-Control':'no-store'}});
   }
   return NextResponse.json({mode:'NEXT_AVAILABLE',itemId:id,nextPickupDate:null,nextReturnDate:null,reason:'Không thấy giờ trống phù hợp trong 90 ngày tới.'},{headers:{'Cache-Control':'no-store'}});
  }
  throw new ApiError(400,'Chế độ tra cứu không hợp lệ.');
 }catch(e){return handleError(e,'POST /api/smart-calendar');}
});}
