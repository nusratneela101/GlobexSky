/**
 * Delivery notification SMS template.
 * @param {Object} vars
 * @param {string} vars.orderId - Short order ID
 * @param {string} vars.deliveryDate - Date of delivery
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function deliveryNotificationTemplate({ orderId, deliveryDate, platformName = 'GlobexSky' }) {
  return `[${platformName}] Great news! Order #${orderId} was delivered on ${deliveryDate}. Enjoy your purchase! Need help? Visit globexsky.com/support`;
}
