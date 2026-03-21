/**
 * Globex Sky — sw.js (Service Worker)
 * Provides offline capability, asset caching, and PWA support.
 * Registered from index.html via navigator.serviceWorker.register('/sw.js').
 */

const CACHE_NAME = 'globexsky-v1';
const DYNAMIC_CACHE = 'globexsky-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/main.css',
  '/assets/css/responsive.css',
  '/assets/css/animations.css',
  '/assets/js/main.js',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/navbar.js',
  '/assets/js/i18n.js',
  '/assets/js/config.js',
  '/assets/images/logo.png',
  '/manifest.json',
  '/locales/en.json',
];

/* ─── Install: pre-cache static shell ──────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual add calls so one failure doesn't abort all
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

/* ─── Activate: clean up old caches ────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !allowedCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ─── Fetch: stale-while-revalidate for static, network-first for API ──── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (except static CDN fonts)
  if (request.method !== 'GET') return;

  // API calls: network only, no caching
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.globexsky.com') {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'Network unavailable. Please check your connection.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // HTML navigation: network-first with offline fallback
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const cloned = res.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, cloned));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Static assets: cache-first with background revalidation
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkRes) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkRes.clone()));
        return networkRes;
      });
      return cached || fetchPromise;
    })
  );
});

/* ─── Push Notifications ────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Globex Sky', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Globex Sky';
  const options = {
    body: data.body || '',
    icon: data.icon || '/assets/images/logo.png',
    badge: '/assets/images/badge.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
