import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monitoringFailureCategory,explainMonitoringError,safeMonitoringDiagnostics} from '../src/lib/monitoring-error.ts';
const css=readFileSync('src/app/globals.css','utf8');
const main=readFileSync('src/app/page.tsx','utf8');
const staff=readFileSync('src/components/GuOrderCapture.tsx','utf8');

test('main app mobile navigation has separate class and only displays below 851px',()=>{
 assert.match(main,/className="gu-main-bottom-nav"/);
 assert.match(css,/@media\(max-width:850px\)\{\.gu-main-bottom-nav\{display:grid\}/);
 assert.match(css,/@media\(min-width:851px\)\{\.gu-main-bottom-nav,\.gu-mobile-new \.gu-staff-bottom-nav,\.gu-mobile-action-panel\{display:none!important\}/);
 assert.doesNotMatch(main,/gu-mobile-bottom-nav/);
});
test('only one responsive workspace remains, with embedded order capture',()=>{
 assert.match(main,/GuOrderCapture/);
 assert.match(staff,/gu-capture-dialog/);
 assert.match(css,/gu-capture-dialog/);
 assert.doesNotMatch(main,/window\.location\.href='\/mobile'/);
});
test('Monitoring classifies 403 billing-required text even when Google provides no reason',()=>{
 const body={error:{code:403,status:'PERMISSION_DENIED',message:'This API method requires billing to be enabled.'}};
 assert.equal(monitoringFailureCategory(403,body),'BILLING_REQUIRED');
 assert.match(explainMonitoringError(403,body),/BILLING_REQUIRED/);
 assert.deepEqual(safeMonitoringDiagnostics(403,body),{httpStatus:403,googleStatus:'PERMISSION_DENIED',googleReason:null,category:'BILLING_REQUIRED'});
});
test('Monitoring unknown 403 does not claim IAM role missing',()=>{
 const body={error:{code:403,status:'PERMISSION_DENIED',message:'Access denied'}};
 assert.equal(monitoringFailureCategory(403,body),'PERMISSION_DENIED_UNKNOWN');
 assert.doesNotMatch(explainMonitoringError(403,body),/cấp thêm Monitoring Viewer/);
});
test('Monitoring error does not relay provider-controlled messages to client',()=>{
 const secret='SECRET_GOOGLE_AUTH_TOKEN';
 const result=explainMonitoringError(403,{error:{status:'PERMISSION_DENIED',message:secret}});
 assert.ok(!result.includes(secret));
});
