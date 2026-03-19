/**
 * SMS service — integrates with Twilio, Vonage, or similar provider.
 * Uses SMS templates for message content.
 */

import { renderSmsTemplate } from './templateEngine.js';

export async function sendSMS(to, message) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SMS] To: ${to} | Message: ${message}`);
    return { success: true, mock: true };
  }
  // TODO: implement real SMS provider (e.g. Twilio)
  throw new Error('SMS provider not configured.');
}

export async function sendOTP(to, { otp, expiresIn, platformName } = {}) {
  const message = await renderSmsTemplate('otp', { otp, expiresIn, platformName });
  return sendSMS(to, message);
}

export async function sendOrderUpdateSMS(to, { orderId, status, platformName } = {}) {
  const message = await renderSmsTemplate('order-update', { orderId, status, platformName });
  return sendSMS(to, message);
}

export async function sendShipmentUpdateSMS(to, { trackingNumber, status, location, platformName } = {}) {
  const message = await renderSmsTemplate('shipment-update', { trackingNumber, status, location, platformName });
  return sendSMS(to, message);
}

export async function sendPaymentConfirmationSMS(to, { amount, orderId, paymentMethod, platformName } = {}) {
  const message = await renderSmsTemplate('payment-confirmation', { amount, orderId, paymentMethod, platformName });
  return sendSMS(to, message);
}

export async function sendDeliveryNotificationSMS(to, { orderId, deliveryDate, platformName } = {}) {
  const message = await renderSmsTemplate('delivery-notification', { orderId, deliveryDate, platformName });
  return sendSMS(to, message);
}

export async function sendDisputeUpdateSMS(to, { disputeId, status, platformName } = {}) {
  const message = await renderSmsTemplate('dispute-update', { disputeId, status, platformName });
  return sendSMS(to, message);
}

export async function sendWelcomeSMS(to, { userName, platformName } = {}) {
  const message = await renderSmsTemplate('welcome', { userName, platformName });
  return sendSMS(to, message);
}
