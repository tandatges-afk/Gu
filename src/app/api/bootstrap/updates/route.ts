import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {countQuery,countGetAll,measureRoute} from '@/lib/read-optimization';
import type {InventoryItem,RentalOrder,Customer} from '@/lib/types';
export const runtime='nodejs';
export const preferredRegion='sin1';
/** Lightweight delta, never used for availability or booking writes.
 * Mark full:true when a delta cannot be proven complete.
 */
export async function GET(req:NextRequest){return measureRoute('GET /api/bootstrap/updates',async()=>{
 try{
  const me=await staffUser(req);
  const since=new URL(req.url).searchParams.get('since')||'';
  const sinceMs=Date.parse(since),now=Date.now();
  if(!Number.isFinite(sinceMs)||sinceMs>now+60_000||now-sinceMs>40*60_000)throw new ApiError(400,'Mốc đồng bộ cũ hoặc không hợp lệ. Hãy tải lại Dashboard.');
  const checkedAt=new Date(now-3000).toISOString(); // overlap prevents missed concurrent writes
  const [orders,items,customers]=await Promise.all([
   db().collection('orders').where('updatedAt','>',since).orderBy('updatedAt').limit(101).get(),
   db().collection('items').where('updatedAt','>',since).orderBy('updatedAt').limit(101).get(),
   db().collection('customers').where('createdAt','>',since).orderBy('createdAt').limit(101).get()
  ]);
  countQuery(orders);countQuery(items);countQuery(customers);
  if(orders.size>100||items.size>100||customers.size>100)return NextResponse.json({full:true,checkedAt},{headers:{'Cache-Control':'private,no-store'}});
  // Order changes can alter inventory state even when the item document has no updatedAt.
  const changedOrders=orders.docs.map(doc=>({id:doc.id,...doc.data()} as RentalOrder));
  const itemIds=[...new Set(changedOrders.flatMap(o=>o.lines.map(l=>l.itemId)))].filter(id=>/^[a-zA-Z0-9]{10,64}$/.test(id));
  if(itemIds.length>100)return NextResponse.json({full:true,checkedAt},{headers:{'Cache-Control':'private,no-store'}});
  const changedItems=itemIds.length?countGetAll(await db().getAll(...itemIds.map(id=>db().collection('items').doc(id)))):[];
  const inventory=new Map(items.docs.map(doc=>[doc.id,{id:doc.id,...doc.data()} as InventoryItem] as const));
  for(const doc of changedItems)if(doc.exists)inventory.set(doc.id,{id:doc.id,...doc.data()} as InventoryItem);
  return NextResponse.json({full:false,checkedAt,
    items:[...inventory.values()],customers:customers.docs.map(doc=>({id:doc.id,...doc.data()} as Customer)),
    orders:changedOrders.filter(o=>me.role==='admin'||!['RETURNED','CANCELLED','VOIDED'].includes(o.status)),
    removedOrderIds:me.role==='admin'?[]:changedOrders.filter(o=>['RETURNED','CANCELLED','VOIDED'].includes(o.status)).map(o=>o.id)},
    {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/bootstrap/updates');}
});}
