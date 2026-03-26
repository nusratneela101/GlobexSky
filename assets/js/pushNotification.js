/**
 * Globex Sky — Push Notification Client
 * Handles service worker registration, push subscription, and permission requests.
 */

const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';

// ─── Utility: convert VAPID public key to Uint8Array ─────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Register Service Worker ──────────────────────────────────────────────────
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PushNotification] Service workers not supported.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/assets/js/service-worker.js');
    console.log('[PushNotification] Service worker registered.');
    return registration;
  } catch (err) {
    console.error('[PushNotification] Service worker registration failed:', err);
    return null;
  }
}

// ─── Request Notification Permission ─────────────────────────────────────────
export async function requestPermission() {
  if (!('Notification' in window)) {
    console.warn('[PushNotification] Notifications not supported.');
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// ─── Fetch VAPID Public Key ───────────────────────────────────────────────────
async function fetchVapidPublicKey() {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`);
  if (!res.ok) throw new Error('Failed to fetch VAPID public key.');
  const { data } = await res.json();
  return data.publicKey;
}

// ─── Subscribe to Push ────────────────────────────────────────────────────────
export async function subscribeToPush(authToken) {
  const registration = await registerServiceWorker();
  if (!registration) return null;

  const permission = await requestPermission();
  if (permission !== 'granted') {
    console.warn('[PushNotification] Permission not granted.');
    return null;
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // Send subscription to backend
  await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ subscription }),
  });

  console.log('[PushNotification] Subscribed to push notifications.');
  return subscription;
}

// ─── Unsubscribe from Push ────────────────────────────────────────────────────
export async function unsubscribeFromPush(authToken) {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${API_BASE}/push/unsubscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
  console.log('[PushNotification] Unsubscribed from push notifications.');
}

// ─── Auto-init on page load ───────────────────────────────────────────────────
// Register the service worker immediately (no subscription yet — user must opt in)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerServiceWorker);
} else {
  registerServiceWorker();
}
