// Saved pages work without a signal: try the network for a few seconds, then use the copy saved by the trip page's button.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const saved = await caches.match(e.request, {ignoreVary: true});
    if (!saved) return fetch(e.request);
    const slow = new Promise(r => setTimeout(() => r(saved), 3000));
    return Promise.race([fetch(e.request).then(r => r.ok || r.type === 'opaque' ? r : saved).catch(() => saved), slow]);
  })());
});
