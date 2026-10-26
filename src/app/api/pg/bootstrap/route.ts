import { NextRequest,NextResponse } from 'next/server';
import { pgRows } from '@/lib/pg-vps';
import { pgCurrentUser, pgError } from '@/lib/pg-security';
export const runtime='nodejs';
export async function GET(req:NextRequest){
  try{
    const me=await pgCurrentUser(req);
    const [counts]=await pgRows<{items:string;customers:string;orders:string;staff:string}>(`
       SELECT (SELECT count(*) FROM inventory_items WHERE archived_at IS NULL)::text AS items,
       (SELECT count(*) FROM customers)::text AS customers,
       (SELECT count(*) FROM rental_orders)::text AS orders,
       (SELECT count(*) FROM staff_users WHERE disabled=FALSE)::text AS staff`);
    return NextResponse.json({me,counts},{headers:{'Cache-Control':'private,no-store'}});
  }catch(e){return pgError(e);}
}
