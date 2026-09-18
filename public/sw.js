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

self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let notification=null;
    try{
      const response=await fetch("/api/push/latest",{cache:"no-store",credentials:"include",headers:{accept:"application/json"}});
      if(response.ok)notification=(await response.json())?.notification??null;
    }catch{}
    const title=notification?.title||"FlyTally";
    const body=notification?.body||"You have a new notification.";
    const href=typeof notification?.href==="string"&&notification.href.startsWith("/")?notification.href:"/notifications";
    await self.registration.showNotification(title,{
      body,
      icon:"/logbook_icon.png",
      badge:"/logbook_icon_32.png",
      tag:notification?.id?`flytally-${notification.id}`:"flytally-notification",
      data:{href},
    });
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const href=event.notification?.data?.href||"/notifications";
  event.waitUntil((async()=>{
    const target=new URL(href,self.location.origin).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin===self.location.origin){
        if("navigate" in client)await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

// FlyTally remains online-only. The service worker does not cache or intercept
// navigation/API data; it additionally handles standards-based Web Push.
