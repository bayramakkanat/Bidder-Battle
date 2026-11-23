// Depo Savaşları – servis çalışanı: kart ve avatar görsellerini önbelleğe alır, oyun trafiğine (socket.io) dokunmaz
const V = 'bb-v3', SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/socket.io')) return;
  if (u.pathname.startsWith('/cards/') || u.pathname.startsWith('/avatars/')) { // görseller: önce önbellek
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })));
  } else { // sayfa ve dosyalar: önce ağ (güncellemeler hemen gelir), çevrimdışıysa önbellek
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r)));
  }
});
