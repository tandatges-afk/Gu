import {NextRequest,NextResponse} from 'next/server';
import {type Query} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {productSearchText,matchesProductSearch} from '@/lib/product-search';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);const u=new URL(req.url);
  const kind=u.searchParams.get('kind')||'items';
  if(!['items','customers','orders'].includes(kind))throw new ApiError(400,'Loại dữ liệu không hợp lệ.');
  const take=Math.max(1,Math.min(50,Number(u.searchParams.get('size'))||30));
  const term=String(u.searchParams.get('q')||'').trim().slice(0,80);
  const mode=u.searchParams.get('field')||'';
  const token=String(u.searchParams.get('cursor')||'');
  let collection:Query=db().collection(kind),field=kind==='orders'?'createdAt':kind==='customers'?'name':'name';
  // Indexed bigrams allow middle-of-name matches without scanning all 2,000 products.
  // Existing products must be backfilled once with `npm run data:apply-names`.
  if(kind==='items'&&term&&mode!=='code'&&!/^GU[-\d]/i.test(term)){
   const normalized=productSearchText(term);
   if(normalized.length<2)throw new ApiError(400,'Nhập ít nhất 2 ký tự để tìm sản phẩm.');
   const snapshot=await db().collection('items').where('nameSearchBigrams','array-contains',normalized.slice(0,2)).limit(400).get();
   const matches=snapshot.docs.filter(d=>!d.data().archivedAt&&matchesProductSearch(String(d.data().name||''),term)).slice(0,take);
   return NextResponse.json({kind,results:matches.map(d=>({id:d.id,...d.data()})),cursor:null,hasMore:false,pageSize:take},{headers:{'Cache-Control':'private,no-store'}});
  }
  // Phone / product-code searches remain indexed prefix queries.
  if(term){
   if(kind==='items')field=mode==='code'||/^GU[-\d]/i.test(term)?'hangerCode':'name';
   else if(kind==='customers')field=mode==='phone'||/^[+\d]/.test(term)?'phone':'name';
   else field=mode==='phone'?'customerPhone':mode==='customer'?'customerName':'code';
  }
  if(kind==='orders'&&me.role!=='admin'&&mode==='history')throw new ApiError(403,'Chỉ Admin được truy xuất lịch sử hoàn tất.');
  const descending=kind==='orders'&&!term;
  // One indexed field plus Firestore's implicit document-ID tie-breaker.
  // The previous explicit second orderBy(__name__) could demand a composite index
  // on some existing Firestore projects even for a simple catalog lookup.
  collection=collection.orderBy(field,descending?'desc':'asc');
  if(term){
   // Legacy GU names are case sensitive in Firestore. Code and phone searches remain exact-prefix.
   const value=field==='hangerCode'?term.toUpperCase():term;
   collection=collection.startAt(value).endAt(value+'\uf8ff');
  }
  if(token){
    let lastValue:string,lastId:string;
    try{
      const parsed=JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as unknown;
      if(!Array.isArray(parsed)||parsed.length!==2||typeof parsed[0]!=='string'||typeof parsed[1]!=='string')throw Error();
      [lastValue,lastId]=parsed;
      if(lastValue.length>256||!/^[a-zA-Z0-9]{10,64}$/.test(lastId))throw Error();
    }catch{throw new ApiError(400,'Trang dữ liệu không hợp lệ.');}
    // Cursor references the last rendered document, preserving order among identical names.
    const lastDoc=await db().collection(kind).doc(lastId).get();
    if(!lastDoc.exists||String(lastDoc.get(field)||'')!==lastValue)
      throw new ApiError(409,'Danh sách đã thay đổi. Vui lòng tải lại.');
    collection=collection.startAfter(lastDoc);
  }
  const snapshot=await collection.limit(take+1).get();
  let docs=snapshot.docs.slice(0,take);
  if(kind==='orders'&&me.role!=='admin')docs=docs.filter(d=>!['RETURNED','CANCELLED','VOIDED'].includes(String(d.data().status)));
  const last=snapshot.docs.slice(0,take).at(-1);
  const cursor=snapshot.size>take&&last?Buffer.from(JSON.stringify([String(last.get(field)||''),last.id])).toString('base64url'):null;
  return NextResponse.json({kind,results:docs.map(d=>({id:d.id,...d.data()})),cursor,hasMore:Boolean(cursor),pageSize:take,
   searchNote:term?'Tìm theo tiền tố, không phải tìm toàn văn.':''},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'GET /api/catalog');}
}
