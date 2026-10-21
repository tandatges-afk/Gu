import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError } from '@/lib/http';
import { Customer, InventoryItem, RentalOrder } from '@/lib/types';
import {cached,countQuery,measureRoute} from '@/lib/read-optimization';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function GET(req: NextRequest) {return measureRoute('GET /api/bootstrap',async()=>{
  try {
    const me = await staffUser(req);
    const load=async()=>{
    const [items, customers, orders, categories, itemCount, availableCount, laundryCount, rentedCount, missingCount, customerCount, activeOrderCount] = await Promise.all([
      db().collection('items').limit(80).get(),
      db().collection('customers').limit(30).get(),
      db().collection('orders').orderBy('createdAt','desc').limit(80).get(),
      db().collection('categories').limit(150).get(),
      db().collection('items').count().get(),
      db().collection('items').where('status','==','AVAILABLE').count().get(),
      db().collection('items').where('status','==','LAUNDRY').count().get(),
      db().collection('items').where('status','==','RENTED').count().get(),
      db().collection('items').where('status','==','MISSING').count().get(),
      db().collection('customers').count().get(),
      db().collection('orders').where('status','in',['RESERVED','PICKED_UP']).count().get()
    ]);
    for(const snap of [items,customers,orders,categories])countQuery(snap);
    const creatorIds=[...new Set(orders.docs.map(o=>String(o.data().createdBy||'')).filter(id=>/^[a-zA-Z0-9]{10,64}$/.test(id)))];
    const creators=creatorIds.length?await db().getAll(...creatorIds.map(id=>db().collection('staff').doc(id))):[];
    const {estimatedReads}=await import('@/lib/read-optimization');estimatedReads(creators.length);
    // Firestore aggregation queries charge index entries, not one read per document.
    return {
      me,
      counts:{items:itemCount.data().count,available:availableCount.data().count,laundry:laundryCount.data().count,
        rented:rentedCount.data().count,missing:missingCount.data().count,customers:customerCount.data().count,activeOrders:activeOrderCount.data().count},
      // Names only, never staff emails or passwords. Legacy orders stored the creator UID.
      staffNames: Object.fromEntries(creators.filter(d=>d.exists).map(d=>[d.id,String(d.data()?.name||'').trim()])),
      categories:categories.docs.map(d=>({id:d.id,...d.data()})),
      items: items.docs.map(d => ({id:d.id,...d.data()})) as InventoryItem[],
      customers: customers.docs.map(d => ({id:d.id,...d.data()})) as Customer[],
      orders: orders.docs.map(d => ({id:d.id,...d.data()} as RentalOrder)).filter(o => me.role==='admin' || !['RETURNED','CANCELLED'].includes(o.status)),
    };
    };
    const payload=new URL(req.url).searchParams.get('fresh')==='1'?await load():await cached('bootstrap:data:'+me.uid,60_000,load);
    return NextResponse.json(payload, {headers:{'Cache-Control':'private,no-store'}});
  } catch (e) {return handleError(e,'GET /api/bootstrap');}
});}
