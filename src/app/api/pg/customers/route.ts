import { NextRequest,NextResponse } from 'next/server';
import { pgRows } from '@/lib/pg-vps';
import {pgCurrentUser,pgError,checkOrigin,jsonObject,needString,PgHttpError} from '@/lib/pg-security';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
  await pgCurrentUser(req);
  const search=new URL(req.url).searchParams.get('q')?.trim().slice(0,60)||'';
  const pattern='%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%';
  const customers=await pgRows('SELECT id,name,phone,note,created_at FROM customers WHERE name ILIKE $1 ESCAPE \'\\\' OR phone LIKE $1 ESCAPE \'\\\' ORDER BY created_at DESC LIMIT 100',[pattern]);
  return NextResponse.json({customers});
}catch(e){return pgError(e);}}
export async function POST(req:NextRequest){try{
  checkOrigin(req);await pgCurrentUser(req);const body=await jsonObject(req);
  const name=needString(body.name,'Tên khách',160);const phone=needString(body.phone,'Số điện thoại',30);
  const normalized=phone.replace(/\D/g,'');
  if(normalized.length<9||normalized.length>15)throw new PgHttpError(400,'Số điện thoại không hợp lệ.');
  const [customer]=await pgRows('INSERT INTO customers(name,phone,phone_normalized,note) VALUES($1,$2,$3,$4) RETURNING id,name,phone,note',[name,phone,normalized,String(body.note||'').slice(0,2000)]);
  return NextResponse.json({customer},{status:201});
}catch(e){return pgError(e);}}
