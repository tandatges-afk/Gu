import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText } from '@/lib/rental';
import { auditInTransaction } from '@/lib/audit';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req: NextRequest) {
  try {
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const name=assertText(b.name,'Tên khách',100);
    const phone=assertText(b.phone,'Số điện thoại',20).replace(/[\s.()-]/g,'');
    if (!/^\+?\d{9,13}$/.test(phone)) throw new ApiError(400,'Số điện thoại không hợp lệ.');
    const sizeNote=assertText(b.sizeNote ?? '', 'Ghi chú size',100,false);
    const note=assertText(b.note ?? '', 'Ghi chú',500,false);
    const ref=db().collection('customers').doc();
    const customer={name,phone,sizeNote,note,createdAt:new Date().toISOString()};
    await db().runTransaction(async tx=>{tx.create(ref,customer);auditInTransaction(tx,me,'CUSTOMER_CREATE','customer',ref.id,`Đã thêm khách: ${name}`);});
    return NextResponse.json({id:ref.id,...customer},{status:201});
  }catch(e){return handleError(e);}
}
