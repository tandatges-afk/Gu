import {NextRequest,NextResponse} from 'next/server';
import {FieldPath,type Query} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {cached,countQuery,measureRoute} from '@/lib/read-optimization';
import {visualCategoryQuery} from '@/lib/visual-search-v55';
export const runtime='nodejs';
export const preferredRegion='sin1';
/** Staff-only metadata, never returns customer or private inspection/deposit images. */
export async function GET(req:NextRequest){
 return measureRoute('GET /api/v5/visual-catalog',async()=>{
  try{
   await staffUser(req);
   const url=new URL(req.url);
   const category=visualCategoryQuery(url.searchParams.get('category')||'');
   const take=50;
   const token=url.searchParams.get('cursor');
   let after:[string,string]|null=null;
   if(token){
    try{
     const raw=JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as unknown;
     if(!Array.isArray(raw)||raw.length!==3||raw[0]!==category||typeof raw[1]!=='string'||typeof raw[2]!=='string'||raw[1].length>150||!/^[a-zA-Z0-9_-]{8,128}$/.test(raw[2]))throw Error();
     after=[raw[1],raw[2]];
    }catch{throw new ApiError(400,'Trang tìm ảnh không hợp lệ.');}
   }
   const key='visual:v55:'+JSON.stringify([category,after,take]);
   const payload=await cached(key,30_000,async()=>{
    let query:Query=db().collection('items');
    if(category!=='ALL')query=query.where('category','==',category);
    query=query.orderBy('name').orderBy(FieldPath.documentId());
    if(after)query=query.startAfter(after[0],after[1]);
    const snaps=countQuery(await query.limit(take+1).get());
    const docs=snaps.docs.slice(0,take);
    const last=docs.at(-1);
    const cursor=snaps.size>take&&last?Buffer.from(JSON.stringify([category,String(last.get('name')||''),last.id])).toString('base64url'):null;
    return {results:docs.filter(d=>!d.data()?.archivedAt).map(d=>{
      const row=d.data();return {id:d.id,name:String(row.name||''),sku:String(row.sku||''),hangerCode:String(row.hangerCode||''),category:String(row.category||''),size:String(row.size||''),color:String(row.color||''),imagePaths:Array.isArray(row.imagePaths)?row.imagePaths.filter((x:unknown):x is string=>typeof x==='string').slice(0,3):[]};
    }),cursor};
   });
   return NextResponse.json(payload,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return handleError(error,'GET /api/v5/visual-catalog');}
 });
}
