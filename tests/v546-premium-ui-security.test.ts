import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isTrustedMutationOrigin} from '../src/lib/request-origin.ts';
import {safeCsv,safeCsvCell} from '../src/lib/safe-csv.ts';
const read=(path:string)=>readFileSync(path,'utf8');
function headers(values:Record<string,string>){return new Headers(values);}
test('cross-site browser mutation blocked even without Origin',()=>{
 assert.equal(isTrustedMutationOrigin(headers({'host':'guthuedo.io.vn','sec-fetch-site':'cross-site'})),false);
 assert.equal(isTrustedMutationOrigin(headers({'host':'guthuedo.io.vn','origin':'https://evil.example'})),false);
 assert.equal(isTrustedMutationOrigin(headers({'host':'guthuedo.io.vn','origin':'https://guthuedo.io.vn'})),true);
 assert.equal(isTrustedMutationOrigin(headers({'host':'localhost:3000','origin':'http://localhost:3000','sec-fetch-site':'same-origin'})),true);
 assert.equal(isTrustedMutationOrigin(headers({'host':'guthuedo.io.vn','origin':'not-a-url'})),false);
});
test('no PII CSV spreadsheet injection; quotes preserved',()=>{
 assert.equal(safeCsvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
 for(const v of ['+1+2','-2+3','@SUM(1)','\t=cmd','\n=cmd','  =cmd']) assert.equal(safeCsvCell(v).startsWith('"\''),true);
 assert.equal(safeCsvCell('Đạt, Nguyễn'), '"Đạt, Nguyễn"');
 assert.equal(safeCsv([['Tên','SĐT'],['Đạt','0988123456']]).includes('"0988123456"'),true);
});
test('admin only export and accessible main navigation',()=>{
 const page=read('src/app/page.tsx');
 assert.match(page,/if\(data\?\.me\.role!=='admin'\)return/);
 assert.match(page,/data\.me\.role==='admin'&&<button className="btn btn-white" onClick=\{exportCsv\}/);
 assert.match(page,/className="skip-link"/);
 assert.match(page,/aria-label="Điều hướng quản lý GU"/);
 assert.match(page,/id="gu-main-content"/);
});
test('authenticated session mutations block cross-origin, login is protected',()=>{
 assert.match(read('src/lib/http.ts'),/isTrustedMutationOrigin\(req\.headers\)/);
 const route=read('src/app/api/local-auth/route.ts');
 assert.match(route,/export async function POST\(req:NextRequest\)/);
 assert.match(route,/export async function DELETE\(req:NextRequest\)/);
 assert.match(route,/isTrustedMutationOrigin\(req\.headers\)/);
});
test('internal GU workspace is noindex, HTTPS and sensitive API responses not cached',()=>{
 const conf=read('next.config.ts');
 assert.match(conf,/Strict-Transport-Security/);
 assert.match(conf,/Cross-Origin-Opener-Policy/);
 assert.match(conf,/Content-Security-Policy/);
 assert.match(conf,/Referrer-Policy',value:'no-referrer'/);
 assert.match(conf,/source:'\/api\/:path\*'.*'private, no-store'/);
 assert.match(read('src/app/layout.tsx'),/robots: \{ index: false/);
 assert.match(read('src/app/robots.ts'),/disallow:'\/'/);
});
test('premium coherent theme loaded after legacy stylesheet and respects reduced motion',()=>{
 const layout=read('src/app/layout.tsx');
 assert.ok(layout.indexOf("import " + "'./gu-premium.css'")>layout.indexOf("import " + "'./globals.css'"));
 const css=read('src/app/gu-premium.css');
 for(const selector of ['.sidebar','.topbar','.modal','.gu-capture-dialog','.login-page','.gu-calendar-toolbar-v532','.filter-toolbar'])assert.ok(css.includes(selector));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(read('src/app/globals.css'),/fonts\.googleapis\.com/);
});
