import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody } from '@/lib/http';
import { assertItems, rentalRequest, requiredSlots } from '@/lib/booking-server';
import { InventoryItem } from '@/lib/types';
import { vietnamToday } from '@/lib/rental';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req:NextRequest) {
  try {
    await staffUser(req);
    const parsed=rentalRequest(await jsonBody(req));
    const snapshots=await db().getAll(...parsed.itemIds.map(id=>db().collection('items').doc(id)));
    const items=snapshots.map(s=>s.exists?({id:s.id,...s.data()} as InventoryItem):null);
    if (items.some(x=>!x)) return NextResponse.json({available:false,conflicts:[],reason:'Có sản phẩm không tồn tại.'});
    const existing=items as InventoryItem[];
    const blocked=existing.filter(x=>Boolean(x.archivedAt)||x.status==='LAUNDRY'||x.status==='MAINTENANCE'||x.status==='MISSING'||!(x.replacementValue>0)||(x.status==='RENTED' && !!x.expectedReturnDate && x.expectedReturnDate<vietnamToday()));
    const refs=requiredSlots(existing,parsed.pickupDate,parsed.returnDate);
    const occupied=await db().getAll(...refs.map(x=>x.ref));
    const conflicts=occupied.flatMap((s,i)=>s.exists?[{itemId:refs[i].item.id,sku:refs[i].item.sku,date:refs[i].day}]:[]);
    return NextResponse.json({available:!blocked.length&&!conflicts.length,conflicts,reason:blocked.length?'Không thể cho thuê (giặt/bảo trì/thất lạc/chưa định giá): '+blocked.map(x=>x.sku).join(', '):''});
  } catch(e){return handleError(e);}
}
