import webpush from 'web-push';
import supabase from '../config/supabase.js';

// Configure VAPID details once on module load
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@globexsky.com'}`,
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

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
  const subs = await getUserSubscriptions(userId);
  await Promise.all(
    subs.map((row) => sendPushToSubscription(JSON.parse(row.subscription), payload)),
  );
}

/**
 * Broadcast a push notification to ALL active subscribers.
 */
export async function broadcastPush(payload) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('active', true);
  if (error) throw new Error(error.message);
  await Promise.all(
    (data || []).map((row) => sendPushToSubscription(JSON.parse(row.subscription), payload)),
  );
}
