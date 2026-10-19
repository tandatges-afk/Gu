import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monitoringFailureCategory,explainMonitoringError,safeMonitoringDiagnostics} from '../src/lib/monitoring-error.ts';
const css=readFileSync('src/app/globals.css','utf8');
const main=readFileSync('src/app/page.tsx','utf8');
const staff=readFileSync('src/app/mobile/page.tsx','utf8');

test('main app mobile navigation has separate class and only displays below 851px',()=>{
 assert.match(main,/className="gu-main-bottom-nav"/);
 assert.match(css,/@media\(max-width:850px\)\{\.gu-main-bottom-nav\{display:grid\}/);
 assert.match(css,/@media\(min-width:851px\)\{\.gu-main-bottom-nav,\.gu-mobile-new \.gu-staff-bottom-nav,\.gu-mobile-action-panel\{display:none!important\}/);
 assert.doesNotMatch(main,/gu-mobile-bottom-nav/);
});
test('staff-only bottom bar is scoped and desktop has top tabs',()=>{
 assert.match(staff,/gu-staff-bottom-nav/);
 assert.match(staff,/gu-staff-top-tabs/);
 assert.match(css,/\.gu-mobile-new \.gu-staff-bottom-nav\{position:fixed/);
 assert.doesNotMatch(css,/\.gu-mobile-bottom-nav/);
 assert.doesNotMatch(staff,/gu-mobile-bottom-nav/);
});
test('no main mobile brand CSS applied to staff brand',()=>{
 assert.match(staff,/className="gu-staff-brand"/);
 assert.match(css,/\.gu-staff-brand\{display:flex/);
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
