import {NextRequest,NextResponse} from 'next/server';
import {FieldPath,type Query} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
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
  // Firestore has no general substring search: support indexed name/code/phone prefixes.
  if(term){
   if(kind==='items')field=mode==='code'||/^GU[-\d]/i.test(term)?'hangerCode':'name';
   else if(kind==='customers')field=mode==='phone'||/^[+\d]/.test(term)?'phone':'name';
   else field=mode==='phone'?'customerPhone':mode==='customer'?'customerName':'code';
  }
  if(kind==='orders'&&me.role!=='admin'&&mode==='history')throw new ApiError(403,'Chỉ Admin được truy xuất lịch sử hoàn tất.');
  const descending=kind==='orders'&&!term;
  collection=collection.orderBy(field,descending?'desc':'asc').orderBy(FieldPath.documentId());
  if(term){
   // Legacy GU names are case sensitive in Firestore. Code and phone searches remain exact-prefix.
   const value=field==='hangerCode'?term.toUpperCase():term;
   collection=collection.startAt(value).endAt(value+'\uf8ff');
  }
  if(token){
   try{
    const [lastValue,lastId]=JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as [string,string];
    if(typeof lastValue!=='string'||typeof lastId!=='string'||lastValue.length>256||!/^[a-zA-Z0-9]{10,64}$/.test(lastId))throw Error();
    collection=collection.startAfter(lastValue,lastId);
   }catch{throw new ApiError(400,'Trang dữ liệu không hợp lệ.');}
  }
  const snapshot=await collection.limit(take+1).get();
  let docs=snapshot.docs.slice(0,take);
  if(kind==='orders'&&me.role!=='admin')docs=docs.filter(d=>!['RETURNED','CANCELLED'].includes(String(d.data().status)));
  const last=snapshot.docs.slice(0,take).at(-1);
  const cursor=snapshot.size>take&&last?Buffer.from(JSON.stringify([String(last.get(field)||''),last.id])).toString('base64url'):null;
  return NextResponse.json({kind,results:docs.map(d=>({id:d.id,...d.data()})),cursor,hasMore:Boolean(cursor),pageSize:take,
   searchNote:term?'Tìm theo tiền tố, không phải tìm toàn văn.':''},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e);}
}
