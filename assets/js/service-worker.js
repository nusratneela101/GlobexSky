/**
 * Globex Sky Service Worker — Push Notifications
 * Handles incoming push events and notification click actions.
 */

const CACHE_NAME = 'globexsky-v1';

// ─── Push Event ──────────────────────────────────────────────────────────────
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
    image: data.image || undefined,
    tag: data.tag || 'globexsky-notification',
    data: { url: data.url || '/', notificationId: data.notificationId },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    actions: data.actions || [
      { action: 'view', title: 'View', icon: '/assets/images/icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notification = event.notification;
  const targetUrl = (notification.data && notification.data.url) || '/';

  notification.close();

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if the URL is already open
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

// ─── Notification Close ──────────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  const notificationId = event.notification.data && event.notification.data.notificationId;
  if (notificationId) {
    fetch('/api/v1/push/dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    }).catch(() => null);
  }
});

// ─── Install & Activate (minimal caching) ───────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
