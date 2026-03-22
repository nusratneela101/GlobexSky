/**
 * Globex Sky — email-templates.js
 * Registry of all transactional email templates.
 * Each entry maps a template key to its subject line and the template
 * file name used by the template engine.
 */

export const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to Globex Sky!',
    template: 'welcome',
    description: 'Sent to new users upon registration.',
  },
  emailVerification: {
    subject: 'Verify your Globex Sky email address',
    template: 'email-verification',
    description: 'Email address verification link.',
  },
  passwordReset: {
    subject: 'Reset your Globex Sky password',
    template: 'password-reset',
    description: 'Password reset link with expiry.',
  },
  orderConfirmation: {
    subject: 'Order Confirmed — #{orderId}',
    template: 'order-confirmation',
    description: 'Sent to buyer after successful order placement.',
  },
  orderShipped: {
    subject: 'Your order has shipped — Tracking: {trackingNumber}',
    template: 'order-shipped',
    description: 'Sent when the order is dispatched.',
  },
  orderDelivered: {
    subject: 'Your order has been delivered!',
    template: 'order-delivered',
    description: 'Sent upon delivery confirmation.',
  },
  orderCancelled: {
    subject: 'Your order has been cancelled — #{orderId}',
    template: 'order-cancelled',
    description: 'Sent when an order is cancelled.',
  },
  paymentReceipt: {
    subject: 'Payment Receipt — #{transactionId}',
    template: 'payment-receipt',
    description: 'Payment receipt / invoice email.',
  },
  paymentFailed: {
    subject: 'Payment Failed — Action Required',
    template: 'payment-failed',
    description: 'Sent when a payment attempt fails.',
  },
  refundProcessed: {
    subject: 'Refund Processed — #{refundId}',
    template: 'refund-processed',
    description: 'Sent when a refund is issued.',
  },
  supplierVerificationApproved: {
    subject: 'Your supplier account has been approved!',
    template: 'supplier-approved',
    description: 'Sent when admin approves a supplier.',
  },
  supplierVerificationRejected: {
    subject: 'Supplier verification update',
    template: 'supplier-rejected',
    description: 'Sent when supplier verification is rejected.',
  },
  newRfqNotification: {
    subject: 'New RFQ received — #{rfqId}',
    template: 'new-rfq',
    description: 'Sent to suppliers when a matching RFQ is posted.',
  },
  newMessageNotification: {
    subject: 'New message from {senderName}',
    template: 'new-message',
    description: 'Sent when a user receives a new chat message.',
  },
  invoiceEmail: {
    subject: 'Invoice #{invoiceNumber} from Globex Sky',
    template: 'invoice',
    description: 'Invoice attachment email.',
  },
  disputeOpened: {
    subject: 'Dispute opened for order #{orderId}',
    template: 'dispute-opened',
    description: 'Sent to both buyer and supplier when a dispute is opened.',
  },
  disputeResolved: {
    subject: 'Your dispute has been resolved — #{disputeId}',
    template: 'dispute-resolved',
    description: 'Sent when a dispute is resolved.',
  },
  escrowFundsHeld: {
    subject: 'Escrow funds held — #{escrowId}',
    template: 'escrow-funds-held',
    description: 'Sent to supplier when escrow holds their payment.',
  },
  escrowFundsReleased: {
    subject: 'Escrow funds released — #{escrowId}',
    template: 'escrow-funds-released',
    description: 'Sent when escrow releases funds to the supplier.',
  },
  subscriptionConfirmation: {
    subject: 'Subscription activated — {planName}',
    template: 'subscription-confirmation',
    description: 'Sent when a subscription plan is activated.',
  },
  subscriptionCancelled: {
    subject: 'Subscription cancelled',
    template: 'subscription-cancelled',
    description: 'Sent when a subscription is cancelled.',
  },
  productSyncComplete: {
    subject: 'Product sync complete — {source}',
    template: 'product-sync-complete',
    description: 'Admin notification when an integration sync finishes.',
  },
};

/**
 * Build the subject for a given template key, substituting placeholders.
 * @param {string} key  - Template key from EMAIL_TEMPLATES
 * @param {object} vars - Placeholder values (e.g. { orderId: '123' })
 * @returns {string}
 */
export function buildSubject(key, vars = {}) {
  const tpl = EMAIL_TEMPLATES[key];
  if (!tpl) return '';
  return tpl.subject.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
