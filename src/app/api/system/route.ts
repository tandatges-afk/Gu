import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,ApiError} from '@/lib/http';
import {serverCredential,db} from '@/lib/firebase-admin';
import {FIRESTORE_FREE,CLOUDINARY_FREE_CREDITS,pacificDayWindow,sumMonitoringSeries,latestMonitoringValue,metricUsage} from '@/lib/usage-metrics';
import {explainMonitoringError} from '@/lib/monitoring-error';
export const runtime='nodejs';
export const preferredRegion='sin1';
export const dynamic='force-dynamic';

type ServiceResult={source:'provider'|'unavailable';message?:string;[key:string]:unknown};
let cached:{at:number;value:{firestore:ServiceResult;cloudinary:ServiceResult}}|null=null;
const TTL=5*60*1000;
async function monitoringMetric(metric:string,start:string,end:string,mode:'sum'|'latest',token:string,project:string){
  const params=new URLSearchParams({filter:`metric.type="firestore.googleapis.com/${metric}" AND resource.type="firestore.googleapis.com/Database"`,
    'interval.startTime':start,'interval.endTime':end,'aggregation.alignmentPeriod':'3600s',
    'aggregation.perSeriesAligner':mode==='sum'?'ALIGN_SUM':'ALIGN_MAX','view':'FULL','pageSize':'1000'});
  const r=await fetch(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(project)}/timeSeries?${params}`,{
    headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!r.ok){
    const googleError=await r.json().catch(()=>null);
    throw new Error(explainMonitoringError(r.status,googleError));
  }
  const result=await r.json();
  // We use 1-hour buckets and a single daily interval, usually < 24 points.
  if(result.nextPageToken)throw new Error('Cloud Monitoring phân trang; chưa có số liệu đầy đủ.');
  return mode==='sum'?sumMonitoringSeries(result):latestMonitoringValue(result);
}
async function firestoreReport(now:Date,window:ReturnType<typeof pacificDayWindow>):Promise<ServiceResult>{
  const project=process.env.FIREBASE_PROJECT_ID||'';
  const basics={quota:FIRESTORE_FREE,projectId:project,pacificDate:window.pacificDate,resetsAt:window.resetsAt,
    resetDescription:'Hạn mức dịch vụ tự làm mới khoảng 00:00 Pacific (Mỹ), theo giờ mùa hè/mùa đông. Không do GU reset.',
    updatedAt:now.toISOString()};
  try{
    const token=await serverCredential()?.getAccessToken();
    if(!token?.access_token)throw new Error('Service account chưa có access token đọc Monitoring.');
    const dayMetrics=['document/read_ops_count','document/write_ops_count','document/delete_ops_count'] as const;
    const settled=await Promise.allSettled([
      ...dayMetrics.map(m=>monitoringMetric(m,window.start,window.end,'sum',token.access_token,project)),
      monitoringMetric('storage/data_and_index_storage_bytes',new Date(now.getTime()-48*3600000).toISOString(),window.end,'latest',token.access_token,project)
    ]);
    const values=settled.map(r=>r.status==='fulfilled'?r.value:null);
    const errors=settled.filter(r=>r.status==='rejected').map(r=>r.status==='rejected'?String(r.reason instanceof Error?r.reason.message:'Không thể lấy số liệu'):'');
    return {...basics,source:errors.length===4?'unavailable':'provider',
      reads:metricUsage(values[0],FIRESTORE_FREE.reads),writes:metricUsage(values[1],FIRESTORE_FREE.writes),
      deletes:metricUsage(values[2],FIRESTORE_FREE.deletes),storage:metricUsage(values[3],FIRESTORE_FREE.storageBytes),
      message:errors.length?`Một số thống kê chưa có: ${errors[0]}`:'Số liệu Cloud Monitoring có thể trễ vài phút và khác số tính phí.'};
  }catch(e){return {...basics,source:'unavailable',reads:metricUsage(null,FIRESTORE_FREE.reads),writes:metricUsage(null,FIRESTORE_FREE.writes),
    deletes:metricUsage(null,FIRESTORE_FREE.deletes),storage:metricUsage(null,FIRESTORE_FREE.storageBytes),
    message:e instanceof Error?e.message:'Không thể kết nối Google Cloud Monitoring.'};}
}
type Part={usage?:number;limit?:number;used_percent?:number};
async function cloudinaryReport():Promise<ServiceResult>{
  const {CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:key,CLOUDINARY_API_SECRET:secret}=process.env;
  if(!cloud||!key||!secret)return{source:'unavailable',message:'Thiếu biến server CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET. Không đưa API Secret lên trình duyệt.'};
  try{
    const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/usage`,{
      headers:{Authorization:'Basic '+Buffer.from(`${key}:${secret}`).toString('base64')},cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('Cloudinary Admin API '+r.status+' (kiểm tra API Key/Secret hoặc hạn mức API).');
    const b=await r.json() as {plan?:string;last_updated?:string;credits?:Part;storage?:Part;bandwidth?:Part;transformations?:Part;resources?:number};
    const part=(v?:Part)=>metricUsage(v?.usage??null,typeof v?.limit==='number'?v.limit:null);
    // Cloudinary uses rolling 30-day credits; do not synthesize credits from storage/bandwidth.
    return{source:'provider',plan:b.plan||'Không rõ',credits:part(b.credits),freeReferenceCredits:CLOUDINARY_FREE_CREDITS,
      storage:part(b.storage),bandwidth:part(b.bandwidth),transformations:part(b.transformations),
      resources:typeof b.resources==='number'?b.resources:null,updatedAt:b.last_updated||null,
      message:'Credits của Cloudinary theo 30 ngày trượt, không reset ngày 1. Chỉ hiển thị số credits nếu API thực sự cung cấp.'};
  }catch(e){return{source:'unavailable',message:e instanceof Error?e.message:'Không thể kết nối Cloudinary Admin API.'};}
}
export async function GET(req:NextRequest){
  try{
    const me=await staffUser(req);
    if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được xem thông tin hệ thống.');
    const now=new Date(),window=pacificDayWindow(now);
    const forceRefresh=req.nextUrl.searchParams.get('refresh')==='1';
    if(forceRefresh||!cached||Date.now()-cached.at>TTL){
      const [firestore,cloudinary,counts]=await Promise.all([firestoreReport(now,window),cloudinaryReport(),
        Promise.allSettled(['items','customers','orders','debtLedger'].map(async name=>[name,(await db().collection(name).count().get()).data().count] as const))]);
      const collectionCounts=Object.fromEntries(counts.flatMap(x=>x.status==='fulfilled'?[x.value]:[]));
      cached={at:Date.now(),value:{firestore:{...firestore,collectionCounts},cloudinary}};
    }
    return NextResponse.json({...cached.value,checkedAt:new Date(cached.at).toISOString(),cacheMinutes:TTL/60000},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return handleError(e);}
}
