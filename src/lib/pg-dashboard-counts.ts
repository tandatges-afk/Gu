import 'server-only';
import {pgPool} from './pg-firestore';
/** Compute dashboard summary in PostgreSQL rather than reading every item.
 * Soft-deleted products are never counted as active stock.
 */
export async function getDashboardCounts(){
 const pool=pgPool();
 const [inventory,customers,orders]=await Promise.all([
  pool.query(`SELECT COUNT(*)::int AS items,
    COUNT(*) FILTER (WHERE data->>'status'='AVAILABLE')::int AS available,
    COUNT(*) FILTER (WHERE data->>'status'='LAUNDRY')::int AS laundry,
    COUNT(*) FILTER (WHERE data->>'status'='RENTED')::int AS rented,
    COUNT(*) FILTER (WHERE data->>'status'='MISSING')::int AS missing
    FROM gu_documents WHERE collection='items' AND COALESCE(data->>'archivedAt','')=''`),
  pool.query("SELECT COUNT(*)::int AS count FROM gu_documents WHERE collection='customers'"),
  pool.query("SELECT COUNT(*)::int AS count FROM gu_documents WHERE collection='orders' AND data->>'status'=ANY($1::text[])",[['RESERVED','PICKED_UP']])
 ]);
 const row=inventory.rows[0];
 return {items:Number(row.items),available:Number(row.available),laundry:Number(row.laundry),rented:Number(row.rented),missing:Number(row.missing),customers:Number(customers.rows[0].count),activeOrders:Number(orders.rows[0].count)};
}
