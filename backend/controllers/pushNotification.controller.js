import * as pushService from '../services/pushNotification.service.js';
import supabase from '../config/supabase.js';
import { sanitiseCategories, sanitiseQuietHours } from '../models/PushSubscription.js';

/** GET /api/v1/push/vapid-public-key */
export async function getVapidPublicKey(req, res) {
  const publicKey = pushService.getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ success: false, error: 'Push notifications are not configured on this server.' });
  }
  res.json({ success: true, data: { publicKey } });
}

/** POST /api/v1/push/subscribe */
export async function subscribe(req, res, next) {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, error: 'Invalid subscription object.' });
    }
    await pushService.saveSubscription(req.user.id, subscription);
    res.status(201).json({ success: true, message: 'Push subscription saved.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/unsubscribe */
export async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Endpoint is required.' });
    }
    await pushService.removeSubscription(req.user.id, endpoint);
    res.json({ success: true, message: 'Push subscription removed.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/push/subscriptions */
export async function getSubscriptions(req, res, next) {
  try {
    const subs = await pushService.getUserSubscriptions(req.user.id);
    res.json({ success: true, data: subs });
  } catch (err) { next(err); }
}

/** GET /api/v1/push/preferences */
export async function getPreferences(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('push_notification_preferences')
      .select('categories, quiet_hours')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    res.json({ success: true, data: data || { categories: {}, quiet_hours: {} } });
  } catch (err) { next(err); }
}

/** PUT /api/v1/push/preferences */
export async function updatePreferences(req, res, next) {
  try {
    const { categories, quiet_hours } = req.body;
    const safeCategories  = sanitiseCategories(categories);
    const safeQuietHours  = sanitiseQuietHours(quiet_hours);

    const { error } = await supabase
      .from('push_notification_preferences')
      .upsert(
        { user_id: req.user.id, categories: safeCategories, quiet_hours: safeQuietHours, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(error.message);
    res.json({ success: true, message: 'Preferences updated.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/push/history */
export async function getHistory(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const { data, error } = await supabase
      .from('push_notification_history')
      .select('id, title, body, url, category, read, sent_at')
      .eq('user_id', req.user.id)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/dismissed — record notification close event */
export async function recordDismissed(req, res, next) {
  try {
    const { notificationId } = req.body;
    // Mark as read in history when dismissed via the notificationclose SW event
    const { error } = await supabase
      .from('push_notification_history')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/test — send a test notification to the current user */
export async function sendTestNotification(req, res, next) {
  try {
    const payload = {
      title: 'Globex Sky — Test Notification',
      body: 'Push notifications are working correctly! 🎉',
      icon: '/assets/images/logo.png',
      url: '/pages/notifications/push-settings.html',
    };
    await pushService.sendPushToUser(req.user.id, payload);
    res.json({ success: true, message: 'Test notification sent.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/send — send to a specific user (admin only) */
export async function sendNotification(req, res, next) {
  try {
    const { user_id, title, body, icon, url } = req.body;
    if (!user_id || !title) {
      return res.status(400).json({ success: false, error: 'user_id and title are required.' });
    }
    const payload = { title, body: body || '', icon: icon || '/assets/images/logo.png', url: url || '/' };
    await pushService.sendPushToUser(user_id, payload);
    res.json({ success: true, message: 'Push notification sent.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/broadcast — send to all subscribers (admin only) */
export async function broadcastNotification(req, res, next) {
  try {
    const { title, body, icon, url } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required.' });
    }
    const payload = { title, body: body || '', icon: icon || '/assets/images/logo.png', url: url || '/' };
    await pushService.broadcastPush(payload);
    res.json({ success: true, message: 'Push notification broadcast sent.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/push/send-bulk — send to a list of users or a named segment (admin only) */
export async function sendBulkNotification(req, res, next) {
  try {
    const { user_ids, title, body, icon, url, category } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required.' });
    }
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'user_ids must be a non-empty array.' });
    }
    const payload = {
      title,
      body: body || '',
      icon: icon || '/assets/images/logo.png',
      url: url || '/',
      ...(category && { tag: category }),
    };
    const result = await pushService.sendBulkPush(user_ids, payload);
    res.json({ success: true, message: 'Bulk push notifications sent.', data: result });
  } catch (err) { next(err); }
}
