const CACHE_PREFIX="flytally-shell-";
const SHELL_CACHE=`${CACHE_PREFIX}v112`;
const OFFLINE_URL="/offline";
const STATIC_URLS=[OFFLINE_URL,"/manifest.webmanifest","/logbook_icon.png","/logbook_icon_32.png"];

async function cacheOfflineShell(){
  const cache=await caches.open(SHELL_CACHE);
  const response=await fetch(OFFLINE_URL,{cache:"reload"});
  if(response.ok){
    await cache.put(OFFLINE_URL,response.clone());
    const html=await response.text();
    const urls=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1]).filter(url=>url.startsWith("/_next/static/")||url==="/logbook_icon.png"||url==="/logbook_icon_32.png");
    await Promise.allSettled([...new Set(urls)].map(async url=>{const asset=await fetch(url,{cache:"reload"});if(asset.ok)await cache.put(url,asset)}));
  }
  await Promise.allSettled(STATIC_URLS.filter(url=>url!==OFFLINE_URL).map(async url=>{const asset=await fetch(url,{cache:"reload"});if(asset.ok)await cache.put(url,asset)}));
}

self.addEventListener("install",event=>{
  event.waitUntil(cacheOfflineShell().finally(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==SHELL_CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{return await fetch(request)}catch{return await caches.match(OFFLINE_URL)||Response.error()}
    })());
    return;
  }

  const cacheable=url.pathname.startsWith("/_next/static/")||STATIC_URLS.includes(url.pathname);
  if(!cacheable)return;
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const network=fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(SHELL_CACHE);await cache.put(request,response.clone())}return response}).catch(()=>null);
    return cached||await network||Response.error();
  })());
});
