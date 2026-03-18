import supabase from '../config/supabase.js';

/**
 * Create a notification for a user.
 */
export async function createNotification({ user_id, title, message, type = 'info', link = null }) {
  const { error } = await supabase.from('notifications').insert({ user_id, title, message, type, read: false, link });
  if (error) console.error('[NotificationService]', error.message);
}

/**
 * Create notifications for multiple users.
 */
export async function createBulkNotifications(userIds, payload) {
  const rows = userIds.map((uid) => ({ user_id: uid, ...payload, read: false }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('[NotificationService]', error.message);
}

/**
 * Send order status notification to buyer.
 */
export async function notifyOrderStatus(buyerId, orderId, status) {
  const messages = {
    confirmed: 'Your order has been confirmed!',
    shipped: 'Your order has been shipped.',
    delivered: 'Your order has been delivered.',
    cancelled: 'Your order was cancelled.',
  };
  await createNotification({
    user_id: buyerId,
    title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: messages[status] || `Your order status changed to ${status}.`,
    type: 'order',
    link: `/pages/account/orders.html?id=${orderId}`,
  });
}
