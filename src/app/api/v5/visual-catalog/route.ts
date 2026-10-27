import {NextRequest,NextResponse} from 'next/server';
import {FieldPath} from '@/lib/pg-firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,requireAdmin,handleError,jsonBody,ApiError} from '@/lib/http';
import {validVisualSignature,validVisualSignatureV2,validVisualIndexEntries,type VisualIndexEntry} from '@/lib/visual-index';
export const runtime='nodejs';export const preferredRegion='sin1';
/** Only compact numerical descriptors are sent to employees. Product photographs
 * are loaded only for the few actual results, not for every inventory row. */
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
    const data=d.data()!;const imagePaths=(data.imagePaths as string[]).slice(0,5);
    const indexed=data.visualImagePath===imagePaths[0]&&validVisualSignature(data.visualSignature);
    const rawSignatures: VisualIndexEntry[]=validVisualIndexEntries(data.visualSignatures)
     ? data.visualSignatures : [];
    const signatures=rawSignatures.filter(entry=>imagePaths.includes(entry.imagePath));
    const missingImages=imagePaths.filter(path=>!signatures.some(entry=>entry.imagePath===path));
    return {id:d.id,category:String(data.category||''),signatures,
     ...(indexed?{signature:data.visualSignature}:{}),
     ...(me.role==='admin'?{missingImages,...(missingImages[0]?{imagePath:missingImages[0]}:{})}:{})};
  });
  return NextResponse.json({results,cursor},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/visual-catalog');}
}
/** Admin-only migration. Multiple viewpoints of one item are indexed separately,
 * while rejecting arbitrary paths, bad signatures, and repeated image references. */
export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);requireAdmin(me);
  const body=await jsonBody(req);const batch=body.entries;
  if(!Array.isArray(batch)||batch.length<1||batch.length>12||batch.some(x=>!x||typeof x!=='object'||typeof x.id!=='string'||!/^[\w-]{10,128}$/.test(x.id)||typeof x.imagePath!=='string'||x.imagePath.length>600||!validVisualSignatureV2(x.signature))||new Set(batch.map(x=>x.id+'|'+x.imagePath)).size!==batch.length)
   throw new ApiError(400,'Tối đa 12 dấu vân tay V2 hợp lệ mỗi lần, không lặp ảnh.');
  const updated=await db().runTransaction(async tx=>{
   let writes=0;
   const groups=new Map<string,typeof batch>();
   for(const entry of batch){const group=groups.get(entry.id)||[];group.push(entry);groups.set(entry.id,group);}
   const refs=[...groups.keys()].map(id=>db().collection('items').doc(id));
   const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
   for(let i=0;i<refs.length;i++){
    const doc=snaps[i],info=doc.data(),updates=groups.get(refs[i].id)!;
    if(!doc.exists||info?.archivedAt)continue;
    const paths=(Array.isArray(info?.imagePaths)?info.imagePaths as string[]:[]).slice(0,5);
    const existing=(validVisualIndexEntries(info?.visualSignatures)?info!.visualSignatures as VisualIndexEntry[]:[])
      .filter(s=>paths.includes(s.imagePath));
    const byPath=new Map(existing.map(entry=>[entry.imagePath,entry]));
    let itemWrites=0;
    for(const entry of updates){
      // The original v1 index was limited to the first photo. V2 accepts only
      // existing product photos and never uploads private customer evidence.
      if(info?.imagePaths?.[0]!==entry.imagePath && !paths.includes(entry.imagePath))continue;
      byPath.set(entry.imagePath,{imagePath:entry.imagePath,signature:entry.signature});writes++;itemWrites++;
    }
    if(byPath.size!==existing.length||itemWrites){tx.update(refs[i],{visualSignatures:paths.flatMap(path=>byPath.has(path)?[byPath.get(path)!]:[]),visualIndexedAt:new Date().toISOString()});}
   }
   return writes;
  });
  return NextResponse.json({updated},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'POST /api/v5/visual-catalog');}
}
