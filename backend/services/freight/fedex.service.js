/**
 * Globex Sky — FedEx API Service
 * Integrates with FedEx REST API v1 for rates, shipment creation, tracking, and labels.
 */

import freightConfig from '../../config/freight.config.js';

const { fedex: config } = freightConfig;

let _accessToken = null;
let _tokenExpiry = 0;

/**
 * Obtain (or reuse cached) FedEx OAuth access token.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  if (!config.clientId) {
    _accessToken = 'mock-token';
    _tokenExpiry = Date.now() + 3600 * 1000;
    return _accessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

/**
 * Get FedEx shipping rates.
 * @param {string} origin  - Origin country code (ISO-2)
 * @param {string} destination - Destination country code (ISO-2)
 * @param {number} weight  - Weight in KG
 * @param {{ length: number, width: number, height: number }} dimensions - cm
 * @returns {Promise<object>}
 */
export async function getRates(origin, destination, weight, dimensions) {
  if (!config.clientId) {
    return {
      carrier: 'FedEx',
      rateReplyDetails: [
        { serviceType: 'FEDEX_INTERNATIONAL_PRIORITY', ratedShipmentDetails: [{ totalNetFedExCharge: { amount: 58.75, currency: 'USD' } }], operationalDetail: { transitTime: 'TWO_DAYS' } },
        { serviceType: 'INTERNATIONAL_ECONOMY', ratedShipmentDetails: [{ totalNetFedExCharge: { amount: 34.20, currency: 'USD' } }], operationalDetail: { transitTime: 'FIVE_DAYS' } },
      ],
    };
  }

  const token = await getAccessToken();
  const body = {
    accountNumber: { value: config.clientId },
    requestedShipment: {
      shipper: { address: { countryCode: origin, postalCode: '10001' } },
      recipient: { address: { countryCode: destination, postalCode: '00100' } },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['LIST', 'ACCOUNT'],
      requestedPackageLineItems: [
        {
          weight: { units: 'KG', value: weight },
          dimensions: {
            length: dimensions?.length || 10,
            width: dimensions?.width || 10,
            height: dimensions?.height || 10,
            units: 'CM',
          },
        },
      ],
    },
  };

  const response = await fetch(`${config.baseUrl}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'FedEx', ...data };
}

/**
 * Create a FedEx shipment.
 * @param {object} shipmentData
 * @returns {Promise<object>}
 */
export async function createShipment(shipmentData) {
  if (!config.clientId) {
    return {
      carrier: 'FedEx',
      output: { transactionShipments: [{ masterTrackingNumber: `FDX${Date.now()}`, serviceType: 'FEDEX_INTERNATIONAL_PRIORITY' }] },
    };
  }

  const token = await getAccessToken();
  const response = await fetch(`${config.baseUrl}/ship/v1/shipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(shipmentData),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'FedEx', ...data };
}

/**
 * Track a FedEx shipment.
 * @param {string} trackingNumber
 * @returns {Promise<object>}
 */
export async function trackShipment(trackingNumber) {
  if (!config.clientId) {
    return {
      carrier: 'FedEx',
      trackingNumber,
      status: 'IN_TRANSIT',
      events: [
        { timestamp: new Date().toISOString(), eventType: 'OC', description: 'Shipment information sent to FedEx' },
      ],
    };
  }

  const token = await getAccessToken();
  const body = { trackingInfo: [{ trackingNumberInfo: { trackingNumber } }], includeDetailedScans: true };
  const response = await fetch(`${config.baseUrl}/track/v1/trackingnumbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'FedEx', ...data };
}

/**
 * Generate a FedEx shipping label.
 * @param {string} shipmentId
 * @returns {Promise<object>}
 */
export async function getLabel(shipmentId) {
  if (!config.clientId) {
    return { carrier: 'FedEx', shipmentId, labelUrl: null, format: 'PDF' };
  }

  const token = await getAccessToken();
  const response = await fetch(`${config.baseUrl}/ship/v1/shipments/${encodeURIComponent(shipmentId)}/results`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'FedEx', ...data };
}
