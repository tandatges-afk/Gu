import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, ApiError } from '@/lib/http';
import { auditInTransaction } from '@/lib/audit';
import { HANGER_COUNTER_DOC, nextHangerSequence, formatHangerCode } from '@/lib/hanger-code';
export const runtime='nodejs';
export const preferredRegion='sin1';
/** Assign display labels to old stock without changing document ID/SKU or historical rental lines. */
export async function POST(req: NextRequest) {
  try {
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được cấp mã sản phẩm cho kho cũ.');
    const items=await db().collection('items').limit(300).get();
    const legacy=items.docs.filter(s=>!s.data().hangerCode&&!s.data().archivedAt).slice(0,25);
    if(!legacy.length)return NextResponse.json({assigned:0,remaining:0});
    const counterRef=db().collection('inventoryCounters').doc(HANGER_COUNTER_DOC);
    const now=new Date().toISOString();
    const assigned=await db().runTransaction(async tx=>{
      const counter=await tx.get(counterRef);
      const snapshots=await Promise.all(legacy.map(doc=>tx.get(doc.ref)));
      let value=counter.data()?.value;
      let count=0;
      for(const snap of snapshots){
        if(!snap.exists||snap.data()?.hangerCode||snap.data()?.archivedAt)continue;
        value=nextHangerSequence(value);
        const code=formatHangerCode(value);
        tx.update(snap.ref,{hangerCode:code});
        auditInTransaction(tx,me,'ITEM_HANGER_CODE','item',snap.id,`Cấp mã sản phẩm ${code}`,now);
        count++;
      }
      if(count)tx.set(counterRef,{value,updatedAt:now});
      return count;
    });
    // UI refreshes and can repeat the action if stock exceeds 25 items.
    return NextResponse.json({assigned,hasMore:items.docs.filter(s=>!s.data().hangerCode&&!s.data().archivedAt).length>assigned});
  }catch(e){return handleError(e);}
}
