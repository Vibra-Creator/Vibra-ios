const CACHE_VERSION = 25;
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
        playNotificationSound(isVibrapp);
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({ 
              type: 'VIBRA_PUSH_RECEIVED', 
              payload: data,
              shouldPlaySound: isVibrapp 
            });
          });
        });
      })
    );
  } catch (e) {
    console.error('[sw] push parse error:', e);
  }
});

function playNotificationSound(isVibrapp) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = audioCtx.createGain();
    master.gain.value = 0.8;
    master.connect(audioCtx.destination);

    const note = (type, freqStart, freqEnd, start, dur, vol, detune = 0) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      
      osc.type = type;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(freqStart, now + start);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + start + dur * 0.9);
      }
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
      gain.gain.setValueAtTime(vol, now + start + dur * 0.75);
      gain.gain.linearRampToValueAtTime(0, now + start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    };

    if (isVibrapp) {
      note('sine', 150, 2200, 0, 0.22, 0.80);
      note('sine', 150, 2200, 0, 0.22, 0.40, 1200);
      note('sawtooth', 200, 800, 0, 0.15, 0.20);
      note('square', 600, 600, 0.26, 0.08, 0.55);
      note('square', 900, 900, 0.36, 0.08, 0.55);
      note('square', 1200, 1200, 0.46, 0.10, 0.60);
      note('sine', 900, 900, 0.26, 0.08, 0.30, -800);
      note('sine', 1350, 1350, 0.36, 0.08, 0.30, -800);
      note('sine', 1800, 1800, 0.46, 0.10, 0.35, -800);
      note('sine', 1200, 80, 0.58, 0.30, 0.35);
      note('sine', 2400, 80, 0.58, 0.30, 0.15);
    } else {
      note('sine', 220, 1800, 0, 0.18, 0.75);
      note('sine', 220, 1800, 0, 0.18, 0.35, 700);
      note('sine', 1800, 440, 0.18, 0.14, 0.65);
      note('square', 880, 880, 0.37, 0.10, 0.45);
      note('sine', 1100, 1100, 0.37, 0.10, 0.30, -1200);
      note('square', 1320, 1320, 0.52, 0.12, 0.50);
      note('sine', 1650, 1650, 0.52, 0.12, 0.28, -1200);
      note('sine', 660, 110, 0.67, 0.18, 0.25);
    }
  } catch (err) {
    console.error('[sw] play sound error:', err);
  }
}

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
