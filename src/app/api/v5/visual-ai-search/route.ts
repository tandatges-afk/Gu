import {NextRequest,NextResponse} from 'next/server';
import {staffUser,ApiError,handleError,boundedUploadBytes} from '@/lib/http';
import {db} from '@/lib/firebase-admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Per-process cost guard. Not a substitute for edge throttling on multi-worker VPS.
const recent=new Map<string,number[]>();
function checkRate(uid:string){
 const now=Date.now();const hits=(recent.get(uid)||[]).filter(t=>now-t<60_000);
 if(hits.length>=8)throw new ApiError(429,'Tìm kiếm quá liên tục. Vui lòng thử lại sau một phút.');
 hits.push(now);recent.set(uid,hits);
 if(recent.size>500)for(const [id,arr] of recent)if(!arr.some(t=>now-t<60_000))recent.delete(id);
}

export async function POST(req:NextRequest){
 try{
  const me=await staffUser(req);
  checkRate(me.uid);
  const category=new URL(req.url).searchParams.get('category')||'ALL';
  if(category.length>100||/[\u0000-\u001f]/.test(category))throw new ApiError(400,'Danh mục không hợp lệ.');
  const token=process.env.GU_VISUAL_AI_SECRET||'';
  if(token.length<32||process.env.GU_VISUAL_AI_ENABLED!=='true')
   return NextResponse.json({ready:false,hits:[]},{headers:{'Cache-Control':'private,no-store'}});
  // All image bytes come through the existing authenticated GU API. Never send
  // customer photos to external providers. Only forward to localhost worker.
  const type=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new ApiError(400,'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  const image=await boundedUploadBytes(req);
  if(image.length<100)throw new ApiError(400,'Ảnh quá nhỏ hoặc không hợp lệ.');
  const port=Number(process.env.GU_VISUAL_AI_PORT||3395);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new ApiError(503,'Cổng xử lý ảnh chưa hợp lệ.');
  let raw:Response;
  try{
   raw=await fetch(`http://127.0.0.1:${port}/search`,{
    method:'POST',headers:{'Content-Type':type,'X-GU-Visual-Token':token,'X-GU-Category':encodeURIComponent(category)},
    body:new Uint8Array(image),signal:AbortSignal.timeout(20_000),cache:'no-store'
   });
  }catch{return NextResponse.json({ready:false,hits:[]},{headers:{'Cache-Control':'private,no-store'}});}
  if(!raw.ok)return NextResponse.json({ready:false,hits:[]},{headers:{'Cache-Control':'private,no-store'}});
  const payload=await raw.json() as {ready?:boolean;hits?:{id:string;score:number}[]};
  if(!payload.ready||!Array.isArray(payload.hits))return NextResponse.json({ready:false,hits:[]});
  const hits=payload.hits.slice(0,8).filter(h=>h&&typeof h.id==='string'&&/^[A-Za-z0-9_-]{10,128}$/.test(h.id)&&Number.isFinite(h.score)&&h.score>=-1&&h.score<=1);
  const unique=[...new Set(hits.map(x=>x.id))];
  const snaps=unique.length?await db().getAll(...unique.map(id=>db().collection('items').doc(id))):[];
  const visible=new Set(snaps.filter(s=>s.exists&&!s.data()?.archivedAt&&(category==='ALL'||s.data()?.category===category)).map(s=>s.id));
  return NextResponse.json({ready:true,hits:hits.filter(h=>visible.has(h.id))},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return handleError(e,'POST /api/v5/visual-ai-search');}
}
