/**
 * Globex Sky — Shipping Carrier Configuration
 * API keys, endpoints, and settings for DHL, FedEx, and UPS.
 * Wraps freight.config.js and adds UPS support.
 */

const SANDBOX = process.env.FREIGHT_SANDBOX !== 'false';

export const shippingConfig = {
  dhl: {
    apiKey: process.env.DHL_API_KEY || '',
    apiSecret: process.env.DHL_API_SECRET || '',
    baseUrl: SANDBOX
      ? 'https://api-mock.dhl.com/mydhlapi'
      : 'https://api-eu.dhl.com/mydhlapi',
    sandbox: SANDBOX,
    timeout: 15000,
  },
  fedex: {
    clientId: process.env.FEDEX_CLIENT_ID || '',
    clientSecret: process.env.FEDEX_CLIENT_SECRET || '',
    baseUrl: SANDBOX
      ? 'https://apis-sandbox.fedex.com'
      : 'https://apis.fedex.com',
    sandbox: SANDBOX,
    timeout: 15000,
  },
  ups: {
    clientId: process.env.UPS_CLIENT_ID || '',
    clientSecret: process.env.UPS_CLIENT_SECRET || '',
    accountNumber: process.env.UPS_ACCOUNT_NUMBER || '',
    baseUrl: SANDBOX
      ? 'https://wwwcie.ups.com/api'
      : 'https://onlinetools.ups.com/api',
    sandbox: SANDBOX,
    timeout: 15000,
  },
  defaults: {
    currency: 'USD',
    weightUnit: 'KG',
    dimensionUnit: 'CM',
    serviceType: 'STANDARD',
  },
};

export default shippingConfig;
