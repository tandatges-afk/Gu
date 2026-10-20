import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,requireAdmin,handleError,jsonBody,ApiError} from '@/lib/http';
import {validVisualSignature} from '@/lib/visual-index';
export const runtime='nodejs';export const preferredRegion='sin1';
/** Lightweight index pages; never download original product pictures per search. */
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);
  const token=new URL(req.url).searchParams.get('cursor');const take=150;
  let query=db().collection('items').orderBy('name').orderBy(FieldPath.documentId());
  if(token){
   try{const parts=JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as unknown;
    if(!Array.isArray(parts)||parts.length!==2||parts.some(x=>typeof x!=='string'||x.length>120))throw Error();
    query=query.startAfter(parts[0],parts[1]);
   }catch{throw new ApiError(400,'Trang chỉ mục ảnh không hợp lệ.');}
  }
  const snaps=await query.limit(take+1).get();const docs=snaps.docs.slice(0,take);const last=docs.at(-1);
  const cursor=snaps.size>take&&last?Buffer.from(JSON.stringify([String(last.get('name')||''),last.id])).toString('base64url'):null;
  const results=docs.filter(d=>!d.data()?.archivedAt&&Array.isArray(d.data()?.imagePaths)&&d.data()!.imagePaths.length).map(d=>{
    const data=d.data()!;const indexed=data.visualImagePath===data.imagePaths[0]&&validVisualSignature(data.visualSignature);
    return {id:d.id,...(indexed?{signature:data.visualSignature}:{}),
     ...(!indexed&&me.role==='admin'?{imagePath:data.imagePaths[0]}:{})};
  });
  return NextResponse.json({results,cursor},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/visual-catalog');}
}
/** Optional one-time backfill for historical photos; images must match an existing active item. */
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const body=await jsonBody(req);const batch=body.entries;
  if(!Array.isArray(batch)||batch.length<1||batch.length>12||batch.some(x=>!x||typeof x!=='object'||typeof x.id!=='string'||!/^[\w-]{10,128}$/.test(x.id)||typeof x.imagePath!=='string'||!validVisualSignature(x.signature))||new Set(batch.map(x=>x.id)).size!==batch.length)
   throw new ApiError(400,'Chỉ cập nhật tối đa 12 đặc trưng ảnh hợp lệ.');
  const updated=await db().runTransaction(async tx=>{
   let writes=0;
   const refs=batch.map(x=>db().collection('items').doc(x.id));const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
   for(let i=0;i<batch.length;i++){
    const doc=snaps[i],entry=batch[i];const info=doc.data();
    if(!doc.exists||info?.archivedAt||info?.imagePaths?.[0]!==entry.imagePath)continue;
    tx.update(refs[i],{visualSignature:entry.signature,visualImagePath:entry.imagePath});writes++;
   }
   return writes;
  });
  return NextResponse.json({updated},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'POST /api/v5/visual-catalog');}
}
