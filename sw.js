// Service worker: pustaka CDN & font cache-first (instan), berkas situs network-first (selalu terbaru, tetap jalan offline).
const V = 'pc-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const cdn = /(^|\.)jsdelivr\.net$|^fonts\.(googleapis|gstatic)\.com$/.test(u.host), same = u.origin === location.origin;
  if (!cdn && !same) return;
  const simpan = x => { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); return x; };
  e.respondWith(cdn ? caches.match(r).then(h => h || fetch(r).then(simpan)) : fetch(r).then(simpan).catch(() => caches.match(r)));
});
