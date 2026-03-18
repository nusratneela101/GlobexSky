import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a tracking number with optional prefix.
 * @param {string} prefix
 */
export function generateTrackingNumber(prefix = 'GSK') {
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}${rand}`;
}

/**
 * Generate a random n-digit OTP.
 */
export function generateOTP(n = 6) {
  return Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)).toString();
}

/**
 * Safely parse JSON — returns null on failure.
 */
export function safeJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/**
 * Mask an email address: j***@example.com
 */
export function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Format a price number to 2 decimal places with currency symbol.
 */
export function formatPrice(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/**
 * Calculate pagination offset.
 */
export function getPaginationOffset(page, limit) {
  return (Math.max(1, page) - 1) * limit;
}
