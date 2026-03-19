/**
 * Payment confirmation SMS template.
 * @param {Object} vars
 * @param {string} vars.amount - Payment amount with currency (e.g. 'USD 150.00')
 * @param {string} vars.orderId - Short order ID
 * @param {string} vars.paymentMethod - Payment method used
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function paymentConfirmationTemplate({ amount, orderId, paymentMethod, platformName = 'Globex Sky' }) {
  return `[${platformName}] Payment of ${amount} received for order #${orderId} via ${paymentMethod}. Thank you!`;
}
