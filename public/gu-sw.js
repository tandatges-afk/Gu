/* GU v5.5.1 hotfix - cache only public offline icons; bypass all Next.js chunks. */
const STATIC_CACHE = 'gu-static-v5-5-1';
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
  // IMPORTANT: Never handle Next.js generated assets. They carry deployment hashes
  // and must be served by the active Next.js deployment / Vercel CDN.
  // Cache-first SW responses can cause cross-deployment JS version skew.
  if (url.pathname.startsWith('/_next/')) return;
  if (!PUBLIC_ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.open(STATIC_CACHE).then(async cache=>{
    const cached=await cache.match(request);
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
    return response;
  }));
});
