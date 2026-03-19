import * as pushService from '../services/pushNotification.service.js';
import supabase from '../config/supabase.js';

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
