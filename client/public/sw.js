const CACHE_VERSION = 7;
const CACHE_NAME = 'vibra-v' + CACHE_VERSION;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.MP4') ||
      url.pathname.endsWith('.mov') || url.pathname.endsWith('.webm') ||
      event.request.headers.get('range')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
