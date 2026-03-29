import webpush from 'web-push';
import supabase from '../config/supabase.js';

// Configure VAPID details only if keys are present
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@globexsky.com'}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
} else {
  console.warn('[PushNotification] VAPID keys not configured — push notifications disabled.');
}

/**
 * Generate a new VAPID key pair (run once, store results in env).
 */
export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}

/**
 * Return the VAPID public key for the client to use when subscribing.
 */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

/**
 * Save a push subscription for a user.
 */
export async function saveSubscription(userId, subscription) {
  const endpoint = subscription.endpoint;

  // Upsert so re-subscribing the same endpoint is idempotent
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, subscription: JSON.stringify(subscription), active: true },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removeSubscription(userId, endpoint) {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

/**
 * Get all active subscriptions for a user.
 */
export async function getUserSubscriptions(userId) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Send a push notification to a single subscription object.
 */
export async function sendPushToSubscription(subscription, payload) {
  if (!pushEnabled) {
    console.warn('[PushNotification] Push not configured — skipping sendPushToSubscription.');
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    // 410 Gone — subscription is no longer valid; mark it inactive
    if (err.statusCode === 410) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .eq('endpoint', subscription.endpoint);
    } else {
      console.error('[PushNotification]', err.message);
    }
  }
}

/**
 * Send a push notification to all active subscriptions of a user.
 */
export async function sendPushToUser(userId, payload) {
  if (!pushEnabled) {
    console.warn('[PushNotification] Push not configured — skipping sendPushToUser.');
    return;
  }
  const subs = await getUserSubscriptions(userId);
  await Promise.all(
    subs.map((row) => sendPushToSubscription(JSON.parse(row.subscription), payload)),
  );
}

/**
 * Broadcast a push notification to ALL active subscribers.
 */
export async function broadcastPush(payload) {
  if (!pushEnabled) {
    console.warn('[PushNotification] Push not configured — skipping broadcast.');
    return;
  }
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('active', true);
  if (error) throw new Error(error.message);
  await Promise.all(
    (data || []).map((row) => sendPushToSubscription(JSON.parse(row.subscription), payload)),
  );
}

/**
 * Send a push notification to a list of user IDs in bulk.
 * @param {string[]} userIds - Array of user IDs to notify.
 * @param {object} payload - Notification payload.
 * @returns {Promise<{sent: number, failed: number}>} Result counts.
 */
export async function sendBulkPush(userIds, payload) {
  if (!userIds || userIds.length === 0) return { sent: 0, failed: 0 };
  if (!pushEnabled) {
    console.warn('[PushNotification] Push not configured — skipping bulk notification.');
    return { sent: 0, failed: 0 };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .in('user_id', userIds)
    .eq('active', true);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  await Promise.all(
    (data || []).map(async (row) => {
      try {
        await sendPushToSubscription(JSON.parse(row.subscription), payload);
        sent++;
      } catch (err) {
        console.error('[PushNotification] sendBulkPush delivery error:', err.message);
        failed++;
      }
    }),
  );
  return { sent, failed };
}
