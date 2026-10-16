import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText, normalizePhone } from '@/lib/rental';
import { auditInTransaction } from '@/lib/audit';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req: NextRequest) {
  try {
    const me=await staffUser(req);
    const b=await jsonBody(req);
    const name=assertText(b.name,'Tên khách',100);
    const phone=normalizePhone(b.phone);
    const note=assertText(b.note ?? '', 'Ghi chú',500,false);
    // Compatibility with historical customer records that predate phoneIndex.
    const legacy=await db().collection('customers').where('phone','==',phone).limit(1).get();
    if(!legacy.empty) return NextResponse.json({id:legacy.docs[0].id,...legacy.docs[0].data(),existing:true});
    const ref=db().collection('customers').doc();
    const phoneRef=db().collection('phoneIndex').doc(encodeURIComponent(phone));
    const customer={name,phone,note,createdAt:new Date().toISOString()};
    let existingId:string|null=null;
    await db().runTransaction(async tx=>{
      const old=await tx.get(phoneRef);
      if(old.exists){existingId=String(old.data()?.customerId||'');return;}
      tx.create(phoneRef,{customerId:ref.id});
      tx.create(ref,customer);
      auditInTransaction(tx,me,'CUSTOMER_CREATE','customer',ref.id,`Đã thêm khách: ${name}`);
    });
    if(existingId){
      const snap=await db().collection('customers').doc(existingId).get();
      if(!snap.exists) throw new ApiError(409,'Số điện thoại được lưu nhưng khách hàng không tồn tại.');
      return NextResponse.json({id:snap.id,...snap.data(),existing:true});
    }
    return NextResponse.json({id:ref.id,...customer},{status:201});
  }catch(e){return handleError(e);}
}

export async function GET(req: NextRequest) {
  try {
    await staffUser(req);
    const q=(new URL(req.url).searchParams.get('phone')||'').replace(/[\s.()-]/g,'');
    if(!/^\d{3,13}$/.test(q)) throw new ApiError(400,'Nhập ít nhất 3 chữ số điện thoại để tìm kiếm.');
    const snap=await db().collection('customers').orderBy('phone').startAt(q).endAt(q+'\uf8ff').limit(20).get();
    return NextResponse.json({customers:snap.docs.map(d=>({id:d.id,...d.data()}))});
  }catch(e){return handleError(e);}
}
