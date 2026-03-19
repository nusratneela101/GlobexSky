import nodemailer from 'nodemailer';
import { PLATFORM_NAME, PLATFORM_EMAIL, DEFAULT_CURRENCY } from '../config/constants.js';
import { renderEmailTemplate } from './templateEngine.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const SUPPORT_URL = `${process.env.FRONTEND_URL || 'https://globexsky.com'}/support`;
const DASHBOARD_URL = `${process.env.FRONTEND_URL || 'https://globexsky.com'}/dashboard`;

function baseVars() {
  return {
    platformName: PLATFORM_NAME,
    supportUrl: SUPPORT_URL,
    year: new Date().getFullYear(),
    currency: DEFAULT_CURRENCY,
  };
}

async function send({ to, subject, html }) {
  return transporter.sendMail({ from: `"${PLATFORM_NAME}" <${PLATFORM_EMAIL}>`, to, subject, html });
}

export async function sendWelcomeEmail(to, { userName, verificationUrl } = {}) {
  const html = renderEmailTemplate('welcome', {
    ...baseVars(),
    userName,
    dashboardUrl: DASHBOARD_URL,
    verificationUrl: verificationUrl || '',
  });
  return send({ to, subject: `Welcome to ${PLATFORM_NAME}!`, html });
}

export async function sendPasswordResetEmail(to, { userName, resetUrl, expiresIn = '1 hour' } = {}) {
  const html = renderEmailTemplate('password-reset', {
    ...baseVars(),
    userName,
    resetUrl,
    expiresIn,
  });
  return send({ to, subject: `Reset your ${PLATFORM_NAME} password`, html });
}

export async function sendOrderConfirmationEmail(to, order) {
  const html = renderEmailTemplate('order-confirmation', {
    ...baseVars(),
    userName: order.userName || order.user_name || '',
    orderId: (order.id || '').slice(0, 8).toUpperCase(),
    orderDate: order.orderDate || order.created_at || '',
    paymentMethod: order.paymentMethod || order.payment_method || '',
    orderTotal: order.total,
    estimatedDelivery: order.estimatedDelivery || order.estimated_delivery || '',
    orderUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/orders/${order.id}`,
  });
  return send({ to, subject: `Order Confirmed — #${(order.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendShippingUpdateEmail(to, order) {
  const html = renderEmailTemplate('order-shipped', {
    ...baseVars(),
    userName: order.userName || order.user_name || '',
    orderId: (order.id || '').slice(0, 8).toUpperCase(),
    trackingNumber: order.tracking_number || order.trackingNumber || '',
    carrier: order.carrier || '',
    shipDate: order.shipDate || order.shipped_at || '',
    estimatedArrival: order.estimatedArrival || order.estimated_arrival || '',
    trackingUrl: order.trackingUrl || order.tracking_url || `${process.env.FRONTEND_URL || 'https://globexsky.com'}/track`,
  });
  return send({ to, subject: `Your order has shipped — Tracking: ${order.tracking_number || order.trackingNumber}`, html });
}

export async function sendOrderDeliveredEmail(to, order) {
  const html = renderEmailTemplate('order-delivered', {
    ...baseVars(),
    userName: order.userName || order.user_name || '',
    orderId: (order.id || '').slice(0, 8).toUpperCase(),
    deliveryDate: order.deliveryDate || order.delivered_at || '',
    returnWindow: order.returnWindow || 7,
    orderUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/orders/${order.id}`,
    reviewUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/orders/${order.id}/review`,
    disputeUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/disputes/new?order=${order.id}`,
  });
  return send({ to, subject: `Your order has been delivered — #${(order.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendDisputeOpenedEmail(to, dispute) {
  const html = renderEmailTemplate('dispute-opened', {
    ...baseVars(),
    userName: dispute.userName || dispute.user_name || '',
    disputeId: (dispute.id || '').slice(0, 8).toUpperCase(),
    orderId: (dispute.orderId || dispute.order_id || '').slice(0, 8).toUpperCase(),
    disputeReason: dispute.reason || '',
    openedDate: dispute.openedDate || dispute.created_at || '',
    reviewDays: dispute.reviewDays || 3,
    disputeUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/disputes/${dispute.id}`,
  });
  return send({ to, subject: `Dispute Opened — #${(dispute.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendDisputeResolvedEmail(to, dispute) {
  const html = renderEmailTemplate('dispute-resolved', {
    ...baseVars(),
    userName: dispute.userName || dispute.user_name || '',
    disputeId: (dispute.id || '').slice(0, 8).toUpperCase(),
    orderId: (dispute.orderId || dispute.order_id || '').slice(0, 8).toUpperCase(),
    resolution: dispute.resolution || '',
    decisionDetail: dispute.decisionDetail || dispute.decision_detail || '',
    resolvedDate: dispute.resolvedDate || dispute.resolved_at || '',
    refundAmount: dispute.refundAmount || dispute.refund_amount || '',
    refundDays: dispute.refundDays || 5,
    disputeUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/disputes/${dispute.id}`,
  });
  return send({ to, subject: `Dispute Resolved — #${(dispute.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendRefundProcessedEmail(to, refund) {
  const html = renderEmailTemplate('refund-processed', {
    ...baseVars(),
    userName: refund.userName || refund.user_name || '',
    orderId: (refund.orderId || refund.order_id || '').slice(0, 8).toUpperCase(),
    refundAmount: refund.amount,
    refundMethod: refund.method || refund.payment_method || '',
    refundReference: refund.reference || refund.id || '',
    processingTime: refund.processingTime || refund.processing_time || '',
    refundDays: refund.refundDays || 5,
    orderUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/orders/${refund.orderId || refund.order_id}`,
  });
  return send({ to, subject: `Refund Processed — Order #${(refund.orderId || refund.order_id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendPaymentReceiptEmail(to, payment) {
  const html = renderEmailTemplate('payment-receipt', {
    ...baseVars(),
    userName: payment.userName || payment.user_name || '',
    paymentId: payment.id || '',
    orderId: (payment.orderId || payment.order_id || '').slice(0, 8).toUpperCase(),
    paymentDate: payment.paymentDate || payment.created_at || '',
    paymentMethod: payment.method || payment.payment_method || '',
    subtotal: payment.subtotal,
    tax: payment.tax || 0,
    totalPaid: payment.total || payment.amount,
    receiptUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/receipts/${payment.id}`,
  });
  return send({ to, subject: `Payment Receipt — ${payment.id}`, html });
}

export async function sendSupplierNewOrderEmail(to, order) {
  const html = renderEmailTemplate('supplier-new-order', {
    ...baseVars(),
    supplierName: order.supplierName || order.supplier_name || '',
    orderId: (order.id || '').slice(0, 8).toUpperCase(),
    buyerName: order.buyerName || order.buyer_name || '',
    orderDate: order.orderDate || order.created_at || '',
    shipByDate: order.shipByDate || order.ship_by_date || '',
    orderValue: order.total,
    orderUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/supplier/orders/${order.id}`,
    dashboardUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/supplier/dashboard`,
  });
  return send({ to, subject: `New Order Received — #${(order.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendInspectionReportEmail(to, inspection) {
  const html = renderEmailTemplate('inspection-report', {
    ...baseVars(),
    userName: inspection.userName || inspection.user_name || '',
    inspectionId: (inspection.id || '').slice(0, 8).toUpperCase(),
    orderId: (inspection.orderId || inspection.order_id || '').slice(0, 8).toUpperCase(),
    inspectorName: inspection.inspectorName || inspection.inspector_name || '',
    inspectionDate: inspection.inspectionDate || inspection.inspected_at || '',
    overallResult: inspection.result || '',
    resultColor: inspection.result === 'PASS' ? '#006644' : '#DE350B',
    score: inspection.score || 0,
    inspectionSummary: inspection.summary || '',
    reportUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/inspections/${inspection.id}`,
  });
  return send({ to, subject: `Inspection Report Ready — #${(inspection.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendShipmentUpdateEmail(to, shipment) {
  const html = renderEmailTemplate('shipment-update', {
    ...baseVars(),
    userName: shipment.userName || shipment.user_name || '',
    trackingNumber: shipment.tracking_number || shipment.trackingNumber || '',
    shipmentStatus: shipment.status || '',
    currentLocation: shipment.currentLocation || shipment.current_location || '',
    lastUpdated: shipment.lastUpdated || shipment.updated_at || '',
    estimatedDelivery: shipment.estimatedDelivery || shipment.estimated_delivery || '',
    trackingUrl: shipment.trackingUrl || shipment.tracking_url || `${process.env.FRONTEND_URL || 'https://globexsky.com'}/track/${shipment.tracking_number || shipment.trackingNumber}`,
  });
  return send({ to, subject: `Shipment Update — ${shipment.tracking_number || shipment.trackingNumber}`, html });
}

export async function sendAccountVerificationEmail(to, { userName, verificationUrl, expiresIn = '24 hours' } = {}) {
  const html = renderEmailTemplate('account-verification', {
    ...baseVars(),
    userName,
    verificationUrl,
    expiresIn,
  });
  return send({ to, subject: `Verify your ${PLATFORM_NAME} account`, html });
}

export async function sendSubscriptionRenewalEmail(to, subscription) {
  const html = renderEmailTemplate('subscription-renewal', {
    ...baseVars(),
    userName: subscription.userName || subscription.user_name || '',
    planName: subscription.planName || subscription.plan_name || '',
    billingPeriod: subscription.billingPeriod || subscription.billing_period || '',
    renewalDate: subscription.renewalDate || subscription.renewal_date || '',
    amount: subscription.amount,
    isRenewal: subscription.isRenewal !== undefined ? subscription.isRenewal : true,
    subscriptionUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/account/subscription`,
  });
  return send({ to, subject: `Subscription ${subscription.isRenewal ? 'Renewed' : 'Renewal Notice'} — ${subscription.planName || subscription.plan_name}`, html });
}

export async function sendRfqResponseEmail(to, rfq) {
  const html = renderEmailTemplate('rfq-response', {
    ...baseVars(),
    userName: rfq.userName || rfq.user_name || '',
    rfqId: (rfq.id || '').slice(0, 8).toUpperCase(),
    supplierName: rfq.supplierName || rfq.supplier_name || '',
    productName: rfq.productName || rfq.product_name || '',
    unitPrice: rfq.unitPrice || rfq.unit_price || '',
    leadTime: rfq.leadTime || rfq.lead_time || '',
    validUntil: rfq.validUntil || rfq.valid_until || '',
    rfqUrl: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/rfq/${rfq.id}`,
  });
  return send({ to, subject: `New Quotation for RFQ #${(rfq.id || '').slice(0, 8).toUpperCase()}`, html });
}

export async function sendNewsletterEmail(to, data) {
  const html = renderEmailTemplate('newsletter', {
    ...baseVars(),
    ...data,
    unsubscribeUrl: data.unsubscribeUrl || `${process.env.FRONTEND_URL || 'https://globexsky.com'}/unsubscribe`,
  });
  return send({ to, subject: data.subject || data.newsletterTitle || `${PLATFORM_NAME} Newsletter`, html });
}

export async function sendGenericEmail(to, subject, html) {
  return send({ to, subject, html });
}
