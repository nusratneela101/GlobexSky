/**
 * Globex Sky — integrations.js
 * Centralised configuration for all third-party API integrations.
 * Every value is sourced from environment variables so that no secrets
 * are hard-coded here.
 */

export const alibabaConfig = {
  appKey: process.env.ALIBABA_APP_KEY || '',
  appSecret: process.env.ALIBABA_APP_SECRET || '',
  accessToken: process.env.ALIBABA_ACCESS_TOKEN || '',
  baseUrl: 'https://gw.open.1688.com/openapi',
  imageStorageBaseUrl: process.env.ALIBABA_IMAGE_BASE_URL || 'https://img.alibaba.com',
  rateLimitPerMinute: parseInt(process.env.ALIBABA_RATE_LIMIT || '60', 10),
  syncIntervalMinutes: parseInt(process.env.ALIBABA_SYNC_INTERVAL || '60', 10),
};

export const china1688Config = {
  appKey: process.env.CHINA_1688_APP_KEY || '',
  appSecret: process.env.CHINA_1688_APP_SECRET || '',
  accessToken: process.env.CHINA_1688_ACCESS_TOKEN || '',
  baseUrl: 'https://gw.open.1688.com/openapi',
  translateApiKey: process.env.TRANSLATE_API_KEY || '',          // Google/DeepL API key
  translateApiUrl: process.env.TRANSLATE_API_URL || 'https://translation.googleapis.com/language/translate/v2',
  cnyToUsdRate: parseFloat(process.env.CNY_USD_RATE || '0.14'), // fallback static rate
  rateLimitPerMinute: parseInt(process.env.CHINA_1688_RATE_LIMIT || '60', 10),
};

export const aliexpressConfig = {
  appKey: process.env.ALIEXPRESS_APP_KEY || '',
  appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
  accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN || '',
  baseUrl: 'https://api-sg.aliexpress.com/sync',
  trackingApiUrl: 'https://api-sg.aliexpress.com/sync',
  rateLimitPerMinute: parseInt(process.env.ALIEXPRESS_RATE_LIMIT || '60', 10),
  priceAlertThresholdPct: parseFloat(process.env.AE_PRICE_ALERT_PCT || '5'),
};

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  connectWebhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
  apiVersion: '2024-04-10',
  currency: process.env.STRIPE_DEFAULT_CURRENCY || 'usd',
};

export const paypalConfig = {
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  mode: process.env.PAYPAL_MODE || 'sandbox',        // 'sandbox' | 'live'
  baseUrl:
    (process.env.PAYPAL_MODE || 'sandbox') === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com',
};

export const escrowConfig = {
  provider: process.env.ESCROW_PROVIDER || 'internal', // 'internal' | 'escrow.com'
  apiKey: process.env.ESCROW_API_KEY || '',
  apiUrl: process.env.ESCROW_API_URL || 'https://api.escrow.com/2017-09-01',
  autoReleaseAfterDays: parseInt(process.env.ESCROW_AUTO_RELEASE_DAYS || '7', 10),
  disputeWindowDays: parseInt(process.env.ESCROW_DISPUTE_WINDOW_DAYS || '3', 10),
};

export const bkashConfig = {
  appKey: process.env.BKASH_APP_KEY || '',
  appSecret: process.env.BKASH_APP_SECRET || '',
  username: process.env.BKASH_USERNAME || '',
  password: process.env.BKASH_PASSWORD || '',
  mode: process.env.BKASH_MODE || 'sandbox',   // 'sandbox' | 'live'
  baseUrl:
    (process.env.BKASH_MODE || 'sandbox') === 'live'
      ? 'https://checkout.pay.bka.sh/v1.2.0-beta'
      : 'https://checkout.sandbox.bka.sh/v1.2.0-beta',
  callbackURL:
    process.env.BKASH_CALLBACK_URL ||
    `${process.env.FRONTEND_URL || 'https://globexsky.com'}/pages/payment/payment.html`,
};

export const nagadConfig = {
  merchantId: process.env.NAGAD_MERCHANT_ID || '',
  merchantPrivateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY || '',
  nagadPublicKey: process.env.NAGAD_PUBLIC_KEY || '',
  mode: process.env.NAGAD_MODE || 'sandbox',   // 'sandbox' | 'live'
  baseUrl:
    (process.env.NAGAD_MODE || 'sandbox') === 'live'
      ? 'https://api.mynagad.com'
      : 'https://sandbox.mynagad.com:10080',
  callbackURL:
    process.env.NAGAD_CALLBACK_URL ||
    `${process.env.FRONTEND_URL || 'https://globexsky.com'}/pages/payment/payment.html`,
};

export const emailConfig = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  fromName: process.env.EMAIL_FROM_NAME || 'Globex Sky',
  fromAddress: process.env.EMAIL_FROM_ADDRESS || 'info@globexsky.com',
  queueEnabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
  trackingEnabled: process.env.EMAIL_TRACKING_ENABLED === 'true',
  trackingBaseUrl: process.env.EMAIL_TRACKING_URL || 'https://globexsky.com/api/v1/email/track',
  unsubscribeBaseUrl: process.env.EMAIL_UNSUBSCRIBE_URL || 'https://globexsky.com/unsubscribe',
};

export const smsConfig = {
  provider: process.env.SMS_PROVIDER || 'twilio', // 'twilio' | 'vonage' | 'aws_sns'
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  vonageApiKey: process.env.VONAGE_API_KEY || '',
  vonageApiSecret: process.env.VONAGE_API_SECRET || '',
  vonageFrom: process.env.VONAGE_FROM || 'GlobexSky',
  queueEnabled: process.env.SMS_QUEUE_ENABLED === 'true',
};

export const pushConfig = {
  vapidEmail: process.env.VAPID_EMAIL || 'admin@globexsky.com',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  analyticsEnabled: process.env.PUSH_ANALYTICS_ENABLED === 'true',
};

export const cloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  productFolder: process.env.CLOUDINARY_PRODUCT_FOLDER || 'globexsky/products',
};

export const dhlConfig = {
  apiKey: process.env.DHL_API_KEY || '',
  apiSecret: process.env.DHL_API_SECRET || '',
  accountNumber: process.env.DHL_ACCOUNT_NUMBER || '',
  baseUrl: process.env.DHL_BASE_URL || 'https://api-mock.dhl.com/mydhlapi',
  webhookToken: process.env.DHL_WEBHOOK_TOKEN || '',
};

export const fedexConfig = {
  clientId: process.env.FEDEX_CLIENT_ID || '',
  clientSecret: process.env.FEDEX_CLIENT_SECRET || '',
  accountNumber: process.env.FEDEX_ACCOUNT_NUMBER || '',
  baseUrl: process.env.FEDEX_BASE_URL || 'https://apis-sandbox.fedex.com',
  webhookSecret: process.env.FEDEX_WEBHOOK_SECRET || '',
};
