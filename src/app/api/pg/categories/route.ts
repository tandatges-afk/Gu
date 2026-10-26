import { NextRequest, NextResponse } from 'next/server';
import { pgRows } from '@/lib/pg-vps';
import {pgCurrentUser,pgError,requirePgAdmin,checkOrigin,jsonObject,needString} from '@/lib/pg-security';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
  await pgCurrentUser(req);
  return NextResponse.json({categories:await pgRows('SELECT id,name FROM categories ORDER BY name')});
}catch(e){return pgError(e);}}
export async function POST(req:NextRequest){try{
  checkOrigin(req);requirePgAdmin(await pgCurrentUser(req));const body=await jsonObject(req);
  const [category]=await pgRows('INSERT INTO categories(name) VALUES($1) RETURNING id,name',[needString(body.name,'Tên danh mục',120)]);
  return NextResponse.json({category},{status:201});
}catch(e){return pgError(e);}}
