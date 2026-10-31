import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError } from '@/lib/http';
import { Customer, InventoryItem, RentalOrder } from '@/lib/types';
import {getDashboardCounts} from '@/lib/pg-dashboard-counts';
import {pgPool} from '@/lib/pg-firestore';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const me = await staffUser(req);
    const [items, customers, orders, categories, staff, counts, creatorRows] = await Promise.all([
      db().collection('items').limit(80).get(),
      db().collection('customers').limit(30).get(),
      db().collection('orders').orderBy('createdAt','desc').limit(80).get(),
      db().collection('categories').limit(150).get(),
      db().collection('staff').limit(500).get(),
      getDashboardCounts(),
      me.role==='admin' ? pgPool().query<{uid:string;snapshot_name:string|null}>(`
        SELECT DISTINCT ON (data->>'createdBy')
          data->>'createdBy' AS uid, nullif(data->>'createdByName','') AS snapshot_name
        FROM gu_documents WHERE collection='orders' AND coalesce(data->>'createdBy','')<>''
        ORDER BY data->>'createdBy', data->>'createdAt' DESC NULLS LAST LIMIT 500
      `) : Promise.resolve({rows:[] as {uid:string;snapshot_name:string|null}[]})
    ]);
    // Prefer the authenticated account's current display name over an outdated
    // profile or order snapshot (e.g. the Admin account renamed to Minh Thiện).
    const staffNames:Record<string,string>=Object.fromEntries(staff.docs
      .filter(d=>me.role==='admin'||orders.docs.some(o=>o.data().createdBy===d.id))
      .map(d=>[d.id,String(d.data().name||'').trim()] as const)
      .filter(([,name])=>Boolean(name)));
    if(me.uid&&String(me.name||'').trim())staffNames[me.uid]=String(me.name).trim();
    const calendarCreatorOptions=creatorRows.rows.map(row=>({uid:row.uid,
      name:staffNames[row.uid]||String(row.snapshot_name||'').trim()||'Chưa rõ nhân viên'}));
    return NextResponse.json({
      me,
      counts,
      // Only actual order creators, stable across all calendar filters.
      staffNames, calendarCreatorOptions,
      categories:categories.docs.map(d=>({id:d.id,...d.data()})),
      items: items.docs.map(d => ({id:d.id,...d.data()})) as InventoryItem[],
      customers: customers.docs.map(d => ({id:d.id,...d.data()})) as Customer[],
      orders: orders.docs.map(d => ({id:d.id,...d.data()} as RentalOrder)).filter(o => me.role==='admin' || !['RETURNED','CANCELLED'].includes(o.status)),
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (e) {return handleError(e,'GET /api/bootstrap');}
}
