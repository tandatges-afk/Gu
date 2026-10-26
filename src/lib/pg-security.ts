import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { pgRows } from './pg-vps';

export const SESSION_COOKIE = 'gu_pg_session';
export type PgRole = 'admin'|'staff';
export type PgUser = { id: string; name: string; email: string; role: PgRole };

export class PgHttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function pgTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function checkOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (!origin) throw new PgHttpError(403, 'Thiếu Origin.');
  const originHost = new URL(origin).host;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  if (originHost !== host) throw new PgHttpError(403, 'Nguồn yêu cầu không hợp lệ.');
  // The Nginx reverse proxy should overwrite Host/X-Forwarded-Host, not trust clients.
}

export async function pgCurrentUser(req: NextRequest): Promise<PgUser> {
  const token = req.cookies.get(SESSION_COOKIE)?.value || '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new PgHttpError(401, 'Bạn chưa đăng nhập.');
  const rows = await pgRows<PgUser>(`
    SELECT u.id, u.display_name AS name, u.email, u.role
    FROM auth_sessions s JOIN staff_users u ON u.id=s.staff_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()
      AND u.disabled=FALSE LIMIT 1`, [pgTokenHash(token)]);
  if (!rows[0]) throw new PgHttpError(401, 'Phiên đăng nhập đã hết hạn.');
  return rows[0];
}

export function requirePgAdmin(me: PgUser): void {
  if (me.role !== 'admin') throw new PgHttpError(403, 'Chỉ quản trị viên có quyền thao tác.');
}

export function pgError(error: unknown): NextResponse {
  if (error instanceof PgHttpError) return NextResponse.json({error:error.message},{status:error.status});
  if (typeof error === 'object' && error && 'code' in error) {
    if (error.code === '23P01') return NextResponse.json({error:'Sản phẩm đã có đơn thuê trùng khoảng thời gian.'},{status:409});
    if (error.code === '23505') return NextResponse.json({error:'Dữ liệu đã tồn tại.'},{status:409});
    if (error.code === '23503') return NextResponse.json({error:'Dữ liệu liên kết không tồn tại.'},{status:400});
    if (error.code === '23514') return NextResponse.json({error:'Dữ liệu không thỏa điều kiện.'},{status:400});
  }
  console.error('[GU_PG]', error instanceof Error ? {message:error.message,name:error.name} : 'Unknown error');
  return NextResponse.json({error:'Lỗi máy chủ PostgreSQL.'},{status:500});
}

export function needString(value:unknown, name:string, max=160):string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new PgHttpError(400,`${name} không hợp lệ.`);
  return value.trim();
}
export function pgUuid(value:unknown,name='ID'): string {
  if (typeof value !== 'string'|| !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new PgHttpError(400, `${name} không hợp lệ.`);
  return value;
}
export function pgAmount(value:unknown,name:string):number {
  if (!Number.isSafeInteger(value)|| Number(value)<0 || Number(value)>1_000_000_000_000) throw new PgHttpError(400, `${name} không hợp lệ.`);
  return Number(value);
}
export async function jsonObject(req:NextRequest):Promise<Record<string,unknown>> {
  if (Number(req.headers.get('content-length')||0)>40_000) throw new PgHttpError(413,'Dữ liệu quá lớn.');
  const body:unknown=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new PgHttpError(400,'JSON không hợp lệ.');
  return body as Record<string,unknown>;
}
