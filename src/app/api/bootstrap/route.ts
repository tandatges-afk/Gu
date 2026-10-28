import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError } from '@/lib/http';
import { Customer, InventoryItem, RentalOrder } from '@/lib/types';
import {getDashboardCounts} from '@/lib/pg-dashboard-counts';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function GET(req: NextRequest) {
  try {
    const me = await staffUser(req);
    const [items, customers, orders, categories, staff, counts] = await Promise.all([
      db().collection('items').limit(80).get(),
      db().collection('customers').limit(30).get(),
      db().collection('orders').orderBy('createdAt','desc').limit(80).get(),
      db().collection('categories').limit(150).get(),
      db().collection('staff').limit(500).get(),
      getDashboardCounts()
    ]);
    return NextResponse.json({
      me,
      counts,
      // Names only, never staff emails or passwords. Legacy orders stored the creator UID.
      staffNames: Object.fromEntries(staff.docs.filter(d=>orders.docs.some(o=>o.data().createdBy===d.id)).map(d=>[d.id,String(d.data().name||'').trim()])),
      categories:categories.docs.map(d=>({id:d.id,...d.data()})),
      items: items.docs.map(d => ({id:d.id,...d.data()})) as InventoryItem[],
      customers: customers.docs.map(d => ({id:d.id,...d.data()})) as Customer[],
      orders: orders.docs.map(d => ({id:d.id,...d.data()} as RentalOrder)).filter(o => me.role==='admin' || !['RETURNED','CANCELLED'].includes(o.status)),
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (e) {return handleError(e,'GET /api/bootstrap');}
}
