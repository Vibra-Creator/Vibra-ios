const CACHE_VERSION = 12;
const CACHE_NAME = 'vibra-v' + CACHE_VERSION;

const PRECACHE_URLS = [
  '/',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
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

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
        }
        return response;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  if (url.pathname === '/favicon.png' || url.pathname === '/manifest.json' || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('/');
      }
      return caches.match(event.request);
    })
  );
});
