const LEGACY_CACHE_PREFIX="flytally-shell-";

self.addEventListener("install",event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(LEGACY_CACHE_PREFIX)).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

// FlyTally v1.12 is intentionally online-only. The service worker exists only
// to preserve PWA installability and to clean up caches from the earlier
// offline prototype. It does not intercept navigation, API or application data.
