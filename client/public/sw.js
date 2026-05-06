const CACHE_VERSION = 33;
const CACHE_NAME = 'vibra-v' + CACHE_VERSION;

const PRECACHE_URLS = [
  '/',
  '/favicon.png',
  '/manifest.json',
  '/vibra-logo.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache miss:', url, err);
          })
        )
      );
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

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const isVibrapp = data.type === 'vibrapp';
    const isVibrappDm = data.type === 'vibrapp-dm';
    const isVibrappLike = isVibrapp || isVibrappDm;
    const title = data.title || 'Vibra';
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.png',
      badge: '/favicon.png',
      vibrate: isVibrappLike
        ? [100, 50, 100, 50, 300, 100, 100, 50, 100]
        : [200, 100, 200, 100, 200],
      data: { url: data.url || '/', type: data.type },
      tag: isVibrappDm ? 'vibrapp-dm-msg' : isVibrapp ? 'vibrapp-msg' : 'vibra-' + Date.now(),
      renotify: true,
      requireInteraction: isVibrappLike,
      silent: false,
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({
              type: 'VIBRA_PUSH_RECEIVED',
              payload: data,
              shouldPlaySound: isVibrappLike
            });
          });
        });
      })
    );
  } catch (e) {
    console.error('[sw] push parse error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relUrl = event.notification.data?.url || '/';
  // client.navigate e clients.openWindow richiedono URL assoluti
  const absUrl = relUrl.startsWith('http') ? relUrl : (self.location.origin + relUrl);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(absUrl).then(() => client.focus());
        }
      }
      return clients.openWindow(absUrl);
    })
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
    // Network-first: always try to get the latest HTML.
    // Fall back to cache only if network fails (offline / server down).
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
        }
        return response;
      }).catch(() =>
        caches.match('/').then((cached) => cached || new Response('', { status: 503 }))
      )
    );
    return;
  }

  if (url.pathname === '/favicon.png' || url.pathname === '/apple-touch-icon.png' || url.pathname === '/vibra-logo.png' || url.pathname === '/manifest.json') {
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
