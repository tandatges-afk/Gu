import { NextRequest, NextResponse } from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {assertText} from '@/lib/rental';
import {auditInTransaction} from '@/lib/audit';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  try{
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const name=assertText(b.name,'Tên danh mục',50);
    const id=encodeURIComponent(name.toLocaleLowerCase('vi-VN'));
    const ref=db().collection('categories').doc(id);
    const createdAt=new Date().toISOString();
    await db().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(snap.exists)throw new ApiError(409,'Danh mục này đã tồn tại.');
      tx.create(ref,{name,createdAt});
      auditInTransaction(tx,me,'CATEGORY_CREATE','category',id,`Thêm danh mục ${name}`);
    });
    return NextResponse.json({id,name,createdAt},{status:201});
  }catch(e){return handleError(e);}
}
