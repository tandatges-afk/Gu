/* GU v4.0 - privacy-first PWA, cache public assets only. */
const STATIC_CACHE = 'gu-static-v5-0-beta10';
const PUBLIC_ASSETS = ['/offline.html','/icons/gu-192.png','/icons/gu-512.png','/favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gu-static-')&&k!==STATIC_CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache responses for /api, HTML pages, authentication, customer data or Firestore.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.includes('auth')) return;
  const isStatic = url.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(url.pathname);
  if(!isStatic)return;
  event.respondWith(caches.open(STATIC_CACHE).then(async cache=>{
    const cached=await cache.match(request);
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
    return response;
  }));
});
