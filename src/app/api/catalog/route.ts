import {NextRequest,NextResponse} from 'next/server';
import {type Query} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {productSearchText,matchesProductSearch} from '@/lib/product-search';
import {isInventoryCodeQuery,inventoryCodeNeedle,matchesInventoryCode} from '@/lib/catalog-code-search';
import {orderGroup,productGroup} from '@/lib/order-group';
export const runtime='nodejs';
export const preferredRegion='sin1';
export async function GET(req:NextRequest){
 try{
  const me=await staffUser(req);const u=new URL(req.url);
  const kind=u.searchParams.get('kind')||'items';
  const ids=u.searchParams.get('ids');
  if(ids!==null){
    if(kind!=='items')throw new ApiError(400,'Chỉ hỗ trợ lấy sản phẩm theo mã.');
    const wanted=ids.split(',').filter(Boolean);
    if(!wanted.length||wanted.length>30||new Set(wanted).size!==wanted.length||wanted.some(id=>!/^[\w-]{10,128}$/.test(id)))throw new ApiError(400,'Danh sách mã sản phẩm không hợp lệ.');
    const snaps=await db().getAll(...wanted.map(id=>db().collection('items').doc(id)));
    return NextResponse.json({kind,results:snaps.filter(d=>d.exists&&!d.data()?.archivedAt).map(d=>({id:d.id,...d.data()})),cursor:null,hasMore:false},
       {headers:{'Cache-Control':'private,no-store'}});
  }
  if(!['items','customers','orders'].includes(kind))throw new ApiError(400,'Loại dữ liệu không hợp lệ.');
  const take=Math.max(1,Math.min(50,Number(u.searchParams.get('size'))||30));
  const term=String(u.searchParams.get('q')||'').trim().slice(0,80);
  const mode=u.searchParams.get('field')||'';
  const token=String(u.searchParams.get('cursor')||'');
  const requestedRentalGroup=['orders','items'].includes(kind)?u.searchParams.get('rentalGroup')||'ALL':'ALL';
  if(!['ALL','CAMERA','CLOTHING'].includes(requestedRentalGroup))throw new ApiError(400,'Bộ lọc loại đơn không hợp lệ.');
  const requestedStatus=kind==='items'?String(u.searchParams.get('status')||'ALL'):'ALL';
  const requestedCategory=kind==='items'?String(u.searchParams.get('category')||'ALL'):'ALL';
  if(!['ALL','AVAILABLE','RENTED','LAUNDRY','MAINTENANCE','MISSING'].includes(requestedStatus)||requestedCategory.length>50)throw new ApiError(400,'Bộ lọc kho không hợp lệ.');
  const inventoryMatches=(entry:Record<string,unknown>)=>!entry.archivedAt&&(requestedStatus==='ALL'||entry.status===requestedStatus)&&(requestedCategory==='ALL'||entry.category===requestedCategory)&&(requestedRentalGroup==='ALL'||productGroup(String(entry.category||''))===requestedRentalGroup);
  let collection:Query=db().collection(kind),field=kind==='orders'?'createdAt':kind==='customers'?'name':'name';
  // Indexed code values cannot perform substring searches with Firestore startAt.
  // Scan an ordered, bounded page of codes and carry a cursor for the last scanned doc.
  // This supports "00", "00002", "234" and full GU codes without Number("00") -> 0.
  if(kind==='items'&&term&&(mode==='code'||isInventoryCodeQuery(term))){
    if(!isInventoryCodeQuery(term))throw new ApiError(400,'Mã tìm kiếm phải chứa từ 1 đến 5 chữ số.');
    const needle=inventoryCodeNeedle(term);
    let codeQuery:Query=db().collection('items').orderBy('hangerCode');
    if(token){
      let parsed:unknown;
      try{parsed=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));}catch{throw new ApiError(400,'Trang tìm kiếm mã không hợp lệ.');}
      if(!Array.isArray(parsed)||parsed.length!==3||parsed[0]!=='code'||parsed[1]!==needle||typeof parsed[2]!=='string'||!/^[\w-]{10,128}$/.test(parsed[2]))throw new ApiError(400,'Trang tìm kiếm mã không hợp lệ.');
      const last=await db().collection('items').doc(parsed[2]).get();
      if(!last.exists)throw new ApiError(409,'Danh sách mã đã thay đổi, vui lòng tìm lại.');
      codeQuery=codeQuery.startAfter(last);
    }
    const matches:Array<{id:string;[key:string]:unknown}>=[];
    let lastId:string|null=null;
    let hasMore=false;
    for(let page=0;page<12;page++){
      const snap=await codeQuery.limit(100).get();
      if(snap.empty){hasMore=false;break;}
      for(const [idx,doc] of snap.docs.entries()){
        lastId=doc.id;
        const entry=doc.data();
        if(inventoryMatches(entry)&&matchesInventoryCode(String(entry.hangerCode||''),term)){
          matches.push({id:doc.id,...entry});
          if(matches.length>=take){hasMore=idx<snap.docs.length-1||snap.size===100;break;}
        }
      }
      if(matches.length<take)hasMore=snap.size===100;
      if(matches.length>=take||!hasMore)break;
      codeQuery=codeQuery.startAfter(snap.docs[snap.docs.length-1]);
    }
    const cursor=hasMore&&lastId?Buffer.from(JSON.stringify(['code',needle,lastId])).toString('base64url'):null;
    return NextResponse.json({kind,results:matches,cursor,hasMore:Boolean(cursor),pageSize:take,
      searchNote:'Tìm mọi vị trí trong mã sản phẩm, không phân biệt các số 0 đầu.'},{headers:{'Cache-Control':'private,no-store'}});
  }
  // Single-char and anywhere-in-name lookup use one-character and two-character
  // indexes. Existing inventory needs `data:apply-names` after this release.
  // Cursor points to the last *scanned* row, not the last matching row, so
  // filters cannot silently skip results between pages.
  if(kind==='items'&&term&&mode!=='code'){
   const normalized=productSearchText(term);
   if(!normalized)return NextResponse.json({kind,results:[],cursor:null,hasMore:false,pageSize:take});
   const indexKey=normalized.length===1?normalized:normalized.slice(0,2);
   let collection=db().collection('items').where('nameSearchBigrams','array-contains',indexKey);
   if(token){
    let parsed:unknown;
    try{parsed=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));}catch{throw new ApiError(400,'Trang tìm kiếm không hợp lệ.');}
    if(!Array.isArray(parsed)||parsed.length!==3||parsed[0]!=='search'||parsed[1]!==normalized||typeof parsed[2]!=='string'||!/^[\w-]{10,128}$/.test(parsed[2]))throw new ApiError(400,'Trang tìm kiếm không hợp lệ.');
    const last=await db().collection('items').doc(parsed[2]).get();
    if(!last.exists)throw new ApiError(409,'Danh sách đã thay đổi; vui lòng tìm lại.');
    collection=collection.startAfter(last);
   }
   const matches:Array<{id:string;[key:string]:unknown}>=[];
   let lastId:string|null=null;let hasMore=false;
   for(let page=0;page<12;page++){
    const snap=await collection.limit(100).get();
    if(snap.empty){hasMore=false;break;}
    for(const [idx,doc] of snap.docs.entries()){
     lastId=doc.id;
     const data=doc.data();
     if(inventoryMatches(data)&&matchesProductSearch([String(data.name||''),String(data.hangerCode||''),String(data.category||'')].join(' '),term)){
      matches.push({id:doc.id,...data});
      if(matches.length>=take){hasMore=idx<snap.docs.length-1||snap.size===100;break;}
     }
    }
    if(matches.length<take)hasMore=snap.size===100;
    if(matches.length>=take||!hasMore)break;
    collection=collection.startAfter(snap.docs[snap.docs.length-1]);
   }
   const cursor=hasMore&&lastId?Buffer.from(JSON.stringify(['search',normalized,lastId])).toString('base64url'):null;
   return NextResponse.json({kind,results:matches,cursor,hasMore:Boolean(cursor),pageSize:take,
    searchNote:'Tìm không dấu trên kho đã đồng bộ chỉ mục; có thể tải trang tiếp theo.'},{headers:{'Cache-Control':'private,no-store'}});
  }
  // Phone / product-code searches remain indexed prefix queries.
  if(term){
   if(kind==='items')field=mode==='code'?'hangerCode':'name';
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
  if(kind==='items'){
    // Fetch enough ACTIVE products for one page, regardless of how many archived
    // documents sort before them. The cursor is the last scanned document.
    const matches:Array<{id:string;[key:string]:unknown}>=[];
    let lastId:string|null=null;let lastValue='';let hasMore=false;
    for(let page=0;page<12;page++){
      const snap=await collection.limit(100).get();
      if(snap.empty){hasMore=false;break;}
      for(const [idx,doc] of snap.docs.entries()){
        lastId=doc.id;lastValue=String(doc.get(field)||'');
        if(inventoryMatches(doc.data())){matches.push({id:doc.id,...doc.data()});if(matches.length>=take){hasMore=idx<snap.docs.length-1||snap.size===100;break;}}
      }
      if(matches.length<take)hasMore=snap.size===100;
      if(matches.length>=take||!hasMore)break;
      collection=collection.startAfter(snap.docs[snap.docs.length-1]);
    }
    const cursor=hasMore&&lastId?Buffer.from(JSON.stringify([lastValue,lastId])).toString('base64url'):null;
    return NextResponse.json({kind,results:matches,cursor,hasMore:Boolean(cursor),pageSize:take},
      {headers:{'Cache-Control':'private,no-store'}});
  }
  if(kind==='orders'&&requestedRentalGroup!=='ALL'){
    const matches:Array<{id:string;[key:string]:unknown}>=[];
    let lastDocId:string|null=null,lastValue='';let hasMore=false;
    for(let page=0;page<12;page++){
      const scan=await collection.limit(100).get();
      if(scan.empty){hasMore=false;break;}
      for(const [idx,doc] of scan.docs.entries()){
        lastDocId=doc.id;lastValue=String(doc.get(field)||'');
        const entry=doc.data();
        if((me.role==='admin'||!['RETURNED','CANCELLED','VOIDED'].includes(String(entry.status)))&&
          (requestedRentalGroup==='CAMERA'?orderGroup({rentalGroup:entry.rentalGroup,lines:Array.isArray(entry.lines)?entry.lines:[]})==='CAMERA':orderGroup({rentalGroup:entry.rentalGroup,lines:Array.isArray(entry.lines)?entry.lines:[]})!=='CAMERA')){
          matches.push({id:doc.id,...entry});
          if(matches.length>=take){hasMore=idx<scan.docs.length-1||scan.size===100;break;}
        }
      }
      if(matches.length<take)hasMore=scan.size===100;
      if(matches.length>=take||!hasMore)break;
      collection=collection.startAfter(scan.docs[scan.docs.length-1]);
    }
    const cursor=hasMore&&lastDocId?Buffer.from(JSON.stringify([lastValue,lastDocId])).toString('base64url'):null;
    return NextResponse.json({kind,results:matches,cursor,hasMore:Boolean(cursor),pageSize:take},{headers:{'Cache-Control':'private,no-store'}});
  }
  const snapshot=await collection.limit(take+1).get();
  let docs=snapshot.docs.slice(0,take);
  // Archived stock retains its original AVAILABLE status in historical Firestore
  // documents. Exclude it before reporting the number of visible results.
  if(kind==='items')docs=docs.filter(d=>!d.data().archivedAt);
  if(kind==='orders'&&me.role!=='admin')docs=docs.filter(d=>!['RETURNED','CANCELLED','VOIDED'].includes(String(d.data().status)));
  const last=snapshot.docs.slice(0,take).at(-1);
  const cursor=snapshot.size>take&&last?Buffer.from(JSON.stringify([String(last.get(field)||''),last.id])).toString('base64url'):null;
  return NextResponse.json({kind,results:docs.map(d=>({id:d.id,...d.data()})),cursor,hasMore:Boolean(cursor),pageSize:take,
   searchNote:term?'Tìm theo tiền tố, không phải tìm toàn văn.':''},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return handleError(e,'GET /api/catalog');}
}
