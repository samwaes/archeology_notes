const CACHE='archeology-notes-field-v1';
const FIELD='/field';
self.addEventListener('install',(event)=>{event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(['/manifest.webmanifest']).catch(()=>undefined)));self.skipWaiting();});
self.addEventListener('activate',(event)=>{event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',(event)=>{
  const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(url.pathname.startsWith('/_next/static/')){event.respondWith(caches.open(CACHE).then(async(cache)=>{const cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}));return;}
  if(request.mode==='navigate'&&url.pathname==='/field'){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok)await cache.put(FIELD,response.clone());return response;}catch{const cached=await cache.match(FIELD);if(cached)return cached;return new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;padding:2rem"><h1>Archeology Notes</h1><p>The field workspace has not yet been cached on this device. Reconnect once, open Field, then it can reopen offline.</p></body>',{headers:{'Content-Type':'text/html'}});}})());
  }
});
