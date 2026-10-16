import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError } from '@/lib/http';
import { Customer, InventoryItem, RentalOrder } from '@/lib/types';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function GET(req: NextRequest) {
  try {
    const me = await staffUser(req);
    const [items, customers, orders, categories, staff, itemCount, availableCount, laundryCount, rentedCount, missingCount, customerCount, activeOrderCount] = await Promise.all([
      db().collection('items').limit(80).get(),
      db().collection('customers').limit(30).get(),
      db().collection('orders').orderBy('createdAt','desc').limit(80).get(),
      db().collection('categories').limit(150).get(),
      db().collection('staff').limit(500).get(),
      db().collection('items').count().get(),
      db().collection('items').where('status','==','AVAILABLE').count().get(),
      db().collection('items').where('status','==','LAUNDRY').count().get(),
      db().collection('items').where('status','==','RENTED').count().get(),
      db().collection('items').where('status','==','MISSING').count().get(),
      db().collection('customers').count().get(),
      db().collection('orders').where('status','in',['RESERVED','PICKED_UP']).count().get()
    ]);
    return NextResponse.json({
      me,
      counts:{items:itemCount.data().count,available:availableCount.data().count,laundry:laundryCount.data().count,
        rented:rentedCount.data().count,missing:missingCount.data().count,customers:customerCount.data().count,activeOrders:activeOrderCount.data().count},
      // Names only, never staff emails or passwords. Legacy orders stored the creator UID.
      staffNames: Object.fromEntries(staff.docs.filter(d=>orders.docs.some(o=>o.data().createdBy===d.id)).map(d=>[d.id,String(d.data().name||'').trim()])),
      categories:categories.docs.map(d=>({id:d.id,...d.data()})),
      items: items.docs.map(d => ({id:d.id,...d.data()})) as InventoryItem[],
      customers: customers.docs.map(d => ({id:d.id,...d.data()})) as Customer[],
      orders: orders.docs.map(d => ({id:d.id,...d.data()} as RentalOrder)).filter(o => me.role==='admin' || !['RETURNED','CANCELLED'].includes(o.status)),
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (e) {return handleError(e);}
}
