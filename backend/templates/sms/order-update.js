/**
 * Order status update SMS template.
 * @param {Object} vars
 * @param {string} vars.orderId - Short order ID
 * @param {string} vars.status - New order status
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function orderUpdateTemplate({ orderId, status, platformName = 'GlobexSky' }) {
  return `[${platformName}] Order #${orderId} update: Your order is now "${status}". Track your order in the app.`;
}
