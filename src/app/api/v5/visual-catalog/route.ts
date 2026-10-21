import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
export const runtime='nodejs';
/** No customer information or pricing is exposed to the mobile visual lookup client. */
export async function GET(req:NextRequest){
 try{
  await staffUser(req);
  const u=new URL(req.url);const take=50;const token=u.searchParams.get('cursor');
  let query=db().collection('items').orderBy('name').orderBy(FieldPath.documentId());
  if(token){
   try{const parts=JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as unknown;
    if(!Array.isArray(parts)||parts.length!==2||parts.some(x=>typeof x!=='string'||x.length>120))throw Error();
    query=query.startAfter(parts[0],parts[1]);
   }catch{throw new ApiError(400,'Trang ảnh tìm kiếm không hợp lệ.');}
  }
  const snaps=await query.limit(take+1).get();const docs=snaps.docs.slice(0,take);
  const last=docs.at(-1);
  const cursor=snaps.size>take&&last?Buffer.from(JSON.stringify([String(last.get('name')||''),last.id])).toString('base64url'):null;
  return NextResponse.json({results:docs.filter(x=>!x.data()?.archivedAt).map(d=>({id:d.id,name:d.data()?.name||'',hangerCode:d.data()?.hangerCode||'',sku:d.data()?.sku||'',size:d.data()?.size||'',category:d.data()?.category||'',imagePaths:(d.data()?.imagePaths||[]).slice(0,1)})),cursor},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e);}
}
