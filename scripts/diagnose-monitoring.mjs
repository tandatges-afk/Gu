/** Safe one-time Cloud Monitoring diagnostics with same service account as GU.
 * Does not log private key, access token, or raw Google response.
 * Use only in trusted Codespaces with .env.local. */
import {cert} from 'firebase-admin/app';
import {safeMonitoringDiagnostics,explainMonitoringError} from '../src/lib/monitoring-error.ts';

const projectId=process.env.FIREBASE_PROJECT_ID;
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey){console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local');process.exitCode=2;}
else{
 try{
  const token=await cert({projectId,clientEmail,privateKey}).getAccessToken();
  const end=new Date();const start=new Date(end.getTime()-60*60*1000);
  const params=new URLSearchParams({filter:'metric.type="firestore.googleapis.com/document/read_ops_count" AND resource.type="firestore.googleapis.com/Database"','interval.startTime':start.toISOString(),'interval.endTime':end.toISOString(),view:'FULL',pageSize:'1'});
  const r=await fetch(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${params}`,{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000)});
  if(r.ok){console.log('Monitoring read works: HTTP',r.status,'(permission/API enabled)');}
  else{const raw=await r.json().catch(()=>null);console.log('Google diagnostic:',safeMonitoringDiagnostics(r.status,raw));console.log('Safe explanation:',explainMonitoringError(r.status,raw));process.exitCode=1;}
 }catch(e){console.error('Could not perform diagnostic:',e instanceof Error?e.name:'unknown error');process.exitCode=1;}
}
