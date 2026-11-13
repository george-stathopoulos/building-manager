const CACHE='πολυκατοικία-v2';const SCOPE=self.registration.scope;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const response=await fetch(SCOPE,{cache:'no-store'});
  if(!response.ok)throw Error('App shell unavailable');
  await cache.put(SCOPE,response);
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  const previous=keys.filter(k=>k.startsWith('πολυκατοικία-')&&k!==CACHE);
  await Promise.all(previous.map(k=>caches.delete(k)));
  await self.clients.claim();
  // Upgrade existing v1 screens too: those screens have no foreground update checker yet.
  if(previous.length){
   const clients=await self.clients.matchAll({type:'window'});
   await Promise.all(clients.filter(c=>c.url.startsWith(SCOPE)).map(c=>c.navigate(c.url).catch(()=>{})));
  }
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin||!req.url.startsWith(SCOPE))return;
 // Never pin installed-app metadata to an old app cache.
 if(url.pathname===new URL('manifest.webmanifest',SCOPE).pathname){event.respondWith(fetch(req,{cache:'no-store'}));return;}
 // Financial data and explicit freshness checks must never be served from app caches.
 if(req.cache==='no-store'||url.pathname.includes('/api/')){event.respondWith(fetch(req));return;}
 if(req.mode==='navigate'){
  event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
   return response;
  }).catch(()=>caches.match(req).then(response=>response||caches.match(SCOPE))));
  return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
  return response;
 })));
});

self.addEventListener('push',event=>{event.waitUntil(self.registration.showNotification('Σάμου 4 · Νέα ενημέρωση',{body:'Έχετε μια νέα ενημέρωση στην εφαρμογή.',icon:'./icon.svg',badge:'./icon.svg',tag:'samou4-update',data:{url:self.registration.scope}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const existing=clients.find(c=>c.url.startsWith(self.registration.scope));if(existing){await existing.focus();return;}await self.clients.openWindow(self.registration.scope);}));});
