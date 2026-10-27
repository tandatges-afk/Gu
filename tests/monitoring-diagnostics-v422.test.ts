import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainMonitoringError,monitoringErrorReason} from '../src/lib/monitoring-error.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Google 403 SERVICE_DISABLED is not misdiagnosed as missing IAM role',()=>{
 const raw={error:{code:403,status:'PERMISSION_DENIED',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'SERVICE_DISABLED',domain:'googleapis.com'}]}};
 assert.equal(monitoringErrorReason(raw),'SERVICE_DISABLED');
 const result=explainMonitoringError(403,raw);
 assert.match(result,/SERVICE_DISABLED/);assert.match(result,/Cloud Monitoring API chưa bật/);
 assert.doesNotMatch(result,/API_SECRET|PRIVATE_KEY|access_token/);
});
test('Unknown Google 403 does not falsely assert Monitoring Viewer absent',()=>{
 const out=explainMonitoringError(403,{error:{status:'PERMISSION_DENIED'}});
 assert.match(out,/nguyên nhân thực tế chưa xác minh/);
 assert.doesNotMatch(out,/cần Monitoring Viewer/);
});
test('IAM, token and invalid request errors are distinguished',()=>{
 const detail=(reason:string)=>({error:{details:[{reason}]}});
 assert.match(explainMonitoringError(403,detail('IAM_PERMISSION_DENIED')),/tài khoản dịch vụ/);
 assert.match(explainMonitoringError(403,detail('ACCESS_TOKEN_SCOPE_INSUFFICIENT')),/OAuth scope/);
 assert.match(explainMonitoringError(400,{}),/không hợp lệ/);
 assert.equal(monitoringErrorReason({error:{details:[{reason:'<script>'}]}}),null);
});
test('System request retrieves Cloudinary only and refresh skips server cache',()=>{
 const api=read('src/app/api/system/route.ts'),ui=read('src/components/GuSystem.tsx');
 assert.match(api,/req.nextUrl.searchParams.get\('refresh'\)==='1'/);
 assert.match(ui,/system\?refresh=1/);
 assert.match(api,/me.role!=='admin'/);
 assert.match(api,/api.cloudinary.com/);
 assert.doesNotMatch(api,/monitoring.googleapis.com|firestoreReport|collection\(.+\)\.count/);
});
