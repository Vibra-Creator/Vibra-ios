const CACHE_VERSION = 24;
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

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const isVibrapp = data.type === 'vibrapp';
    const title = data.title || 'Vibra';
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.png',
      badge: '/favicon.png',
      vibrate: isVibrapp
        ? [100, 50, 100, 50, 300, 100, 100, 50, 100]
        : [200, 100, 200, 100, 200],
      data: { url: data.url || '/', type: data.type },
      tag: isVibrapp ? 'vibrapp-msg' : 'vibra-' + Date.now(),
      renotify: true,
      requireInteraction: isVibrapp,
      silent: false,
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({ type: 'VIBRA_PUSH_RECEIVED', payload: data });
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
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
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
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/').then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put('/', response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
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
