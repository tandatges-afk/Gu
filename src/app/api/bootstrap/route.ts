import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError } from '@/lib/http';
import { Customer, InventoryItem, RentalOrder } from '@/lib/types';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function GET(req: NextRequest) {
  try {
    const me = await staffUser(req);
    const [items, customers, orders, categories] = await Promise.all([
      db().collection('items').limit(300).get(),
      db().collection('customers').limit(500).get(),
      db().collection('orders').orderBy('createdAt','desc').limit(300).get(),
      db().collection('categories').limit(150).get()
    ]);
    return NextResponse.json({
      me,
      categories:categories.docs.map(d=>({id:d.id,...d.data()})),
      items: items.docs.map(d => ({id:d.id,...d.data()})) as InventoryItem[],
      customers: customers.docs.map(d => ({id:d.id,...d.data()})) as Customer[],
      orders: orders.docs.map(d => ({id:d.id,...d.data()} as RentalOrder)).filter(o => me.role==='admin' || !['RETURNED','CANCELLED'].includes(o.status)),
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (e) {return handleError(e);}
}
