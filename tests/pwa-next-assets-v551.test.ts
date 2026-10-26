import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../public/gu-sw.js', import.meta.url), 'utf8');

test('Service Worker bypasses hashed Next.js scripts while keeping public offline assets', async () => {
  const handlers = new Map<string, (event: any)=>void>();
  const selfMock = {
    location:{origin:'https://gu-nu.vercel.app'},
    addEventListener(type:string, cb:(event:any)=>void) { handlers.set(type,cb); },
    skipWaiting(){}, clients:{claim(){}}
  };
  const cacheMock = {open:async()=>({match:async()=>undefined,put:async()=>{}})};
  vm.runInNewContext(code,{self:selfMock,caches:cacheMock,URL,fetch:async()=>({ok:true,type:'basic',clone(){return this;}})});
  const callback = handlers.get('fetch');
  assert.ok(callback);
  let scriptIntercepted = false;
  callback!({request:{method:'GET',mode:'no-cors',url:'https://gu-nu.vercel.app/_next/static/chunks/app/page-abc.js'},respondWith(){scriptIntercepted=true;}});
  assert.equal(scriptIntercepted,false,'hashed Next.js assets must bypass SW');
  let iconIntercepted = false;
  let responsePromise: Promise<unknown> | undefined;
  callback!({request:{method:'GET',mode:'no-cors',url:'https://gu-nu.vercel.app/favicon.svg'},respondWith(p:Promise<unknown>){iconIntercepted=true;responsePromise=p;}});
  assert.equal(iconIntercepted,true,'public offline icons remain cacheable');
  await responsePromise;
});
