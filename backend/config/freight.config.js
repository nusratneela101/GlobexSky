/**
 * Globex Sky — Freight Carrier Configuration
 * API keys, endpoints, sandbox/production modes for DHL, FedEx, Aramex.
 */

const SANDBOX = process.env.FREIGHT_SANDBOX !== 'false';

export const freightConfig = {
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
  aramex: {
    username: process.env.ARAMEX_USERNAME || '',
    password: process.env.ARAMEX_PASSWORD || '',
    accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '',
    accountPin: process.env.ARAMEX_ACCOUNT_PIN || '',
    accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY || '',
    accountCountryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'US',
    baseUrl: SANDBOX
      ? 'https://ws.dev.aramex.net/ShippingAPI.V2'
      : 'https://ws.aramex.net/ShippingAPI.V2',
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

export default freightConfig;
