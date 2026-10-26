import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {rows} from '@/lib/db';
export const COOKIE='gu_session';
export type User={id:string;email:string;name:string;role:'admin'|'staff'};
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export function hash(t:string){return createHash('sha256').update(t).digest('hex');}
export function enforceOrigin(req:NextRequest){const origin=req.headers.get('origin');const trusted=process.env.APP_URL; if(!origin)throw new HttpError(403,'Thiếu Origin');let actual:string;try{actual=new URL(origin).origin;}catch{throw new HttpError(403,'Origin không hợp lệ');}
  if(trusted){const allowed=trusted.replace(/\/$/,'');if(actual!==allowed && !(actual==='http://localhost:3100'&&allowed==='http://localhost:3100'))throw new HttpError(403,'Origin không được cho phép');}
  else {const host=req.headers.get('host');if(!host||new URL(origin).host!==host)throw new HttpError(403,'Nguồn yêu cầu không hợp lệ');}
}
export async function me(req:NextRequest):Promise<User>{const t=req.cookies.get(COOKIE)?.value||'';if(!/^[0-9a-f]{64}$/.test(t))throw new HttpError(401,'Vui lòng đăng nhập');const u=await rows<User>('SELECT u.id,u.email,u.display_name AS name,u.role FROM auth_sessions s JOIN staff_users u ON u.id=s.staff_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled=false LIMIT 1',[hash(t)]);if(!u[0])throw new HttpError(401,'Phiên đăng nhập đã hết hạn');return u[0];}
export function admin(u:User){if(u.role!=='admin')throw new HttpError(403,'Chỉ Admin được thực hiện thao tác này');}
export function str(v:unknown,name:string,max=240):string{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new HttpError(400,`${name} không hợp lệ`);return v.trim();}
export function optional(v:unknown,max=3000):string{return typeof v==='string'?v.trim().slice(0,max):'';}
export function uuid(v:unknown):string{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))throw new HttpError(400,'ID không hợp lệ');return v;}
export function amount(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>1e12)throw new HttpError(400,'Số tiền không hợp lệ');return v;}
export async function body(req:NextRequest):Promise<Record<string,unknown>>{if(Number(req.headers.get('content-length')||0)>60_000)throw new HttpError(413,'Dữ liệu quá lớn');const x:unknown=await req.json().catch(()=>null);if(!x||Array.isArray(x)||typeof x!=='object')throw new HttpError(400,'JSON không hợp lệ');return x as Record<string,unknown>;}
export function fail(e:unknown):NextResponse{if(e instanceof HttpError)return NextResponse.json({error:e.message},{status:e.status});if(typeof e==='object'&&e&&'code'in e){const code=e.code;if(code==='23P01')return NextResponse.json({error:'Sản phẩm đã có đơn thuê trùng thời gian'},{status:409});if(code==='23505')return NextResponse.json({error:'Dữ liệu bị trùng'},{status:409});if(code==='23503'||code==='22P02')return NextResponse.json({error:'Mã tham chiếu không hợp lệ'},{status:400});if(code==='23514')return NextResponse.json({error:'Dữ liệu không đáp ứng điều kiện'},{status:400});}
console.error('[GU]',e instanceof Error?e.message:'Unknown error');return NextResponse.json({error:'Lỗi máy chủ, xem nhật ký dịch vụ GU'},{status:500});}
export async function audit(db:{query:(sql:string,args?:unknown[])=>Promise<unknown>},user:string,action:string,type:string,id:string,detail:unknown={}){await db.query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[user,action,type,id,JSON.stringify(detail)]);}
