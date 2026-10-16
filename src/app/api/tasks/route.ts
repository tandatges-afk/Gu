import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {vietnamToday} from '@/lib/rental';
import type {RentalOrder} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  await staffUser(req);
  const today=vietnamToday();
  const snaps=await Promise.all([
    db().collection('orders').where('status','==','PICKED_UP').limit(500).get(),
    db().collection('orders').where('pickupDate','==',today).limit(200).get(),
    db().collection('orders').where('returnDate','==',today).limit(200).get()
  ]);
  if(snaps[0].size>=500||snaps[1].size>=200||snaps[2].size>=200)throw new ApiError(503,'Có quá nhiều việc cần xử lý; vui lòng mở danh sách đầy đủ hoặc liên hệ Admin.');
  const map=new Map<string,RentalOrder>();
  for(const snap of snaps)for(const doc of snap.docs){const o={id:doc.id,...doc.data()} as RentalOrder;
    if(o.status==='PICKED_UP'||(o.status==='RESERVED'&&o.pickupDate===today))map.set(o.id,o);}
  return NextResponse.json({orders:[...map.values()]},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
