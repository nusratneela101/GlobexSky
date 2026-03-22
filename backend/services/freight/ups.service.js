/**
 * Globex Sky — UPS API Service
 * Integrates with UPS REST API for rates, shipment creation, tracking, and labels.
 */

import freightConfig from '../../config/freight.config.js';

const { ups: config } = freightConfig;

let _accessToken = null;
let _tokenExpiry = 0;

/**
 * Obtain (or reuse cached) UPS OAuth access token.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  if (!config.clientId) {
    _accessToken = 'mock-token';
    _tokenExpiry = Date.now() + 3600 * 1000;
    return _accessToken;
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const params = new URLSearchParams({ grant_type: 'client_credentials' });

  const response = await fetch(`${config.baseUrl}/security/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

/**
 * Get UPS shipping rates.
 * @param {string} origin  - Origin country code (ISO-2)
 * @param {string} destination - Destination country code (ISO-2)
 * @param {number} weight  - Weight in KG
 * @param {{ length: number, width: number, height: number }} dimensions - cm
 * @returns {Promise<object>}
 */
export async function getRates(origin, destination, weight, dimensions) {
  if (!config.clientId) {
    return {
      carrier: 'UPS',
      RateResponse: {
        RatedShipment: [
          {
            Service: { Code: '07', Description: 'UPS Worldwide Express' },
            TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '52.30' },
            GuaranteedDelivery: { BusinessDaysInTransit: '2' },
          },
          {
            Service: { Code: '08', Description: 'UPS Worldwide Expedited' },
            TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '36.80' },
            GuaranteedDelivery: { BusinessDaysInTransit: '5' },
          },
        ],
      },
    };
  }

  const token = await getAccessToken();
  const body = {
    RateRequest: {
      Request: { RequestOption: 'Shop', TransactionReference: { CustomerContext: `GlobexSky-${Date.now()}` } },
      Shipment: {
        Shipper: {
          Name: 'Globex Sky',
          ShipperNumber: config.accountNumber,
          Address: { CountryCode: origin, PostalCode: '10001', City: 'New York' },
        },
        ShipTo: {
          Name: 'Recipient',
          Address: { CountryCode: destination, PostalCode: '00100', City: 'City' },
        },
        ShipFrom: {
          Name: 'Globex Sky',
          Address: { CountryCode: origin, PostalCode: '10001', City: 'New York' },
        },
        Service: { Code: '03' },
        Package: {
          PackagingType: { Code: '02' },
          Dimensions: {
            UnitOfMeasurement: { Code: 'CM' },
            Length: String(dimensions?.length || 10),
            Width: String(dimensions?.width || 10),
            Height: String(dimensions?.height || 10),
          },
          PackageWeight: {
            UnitOfMeasurement: { Code: 'KGS' },
            Weight: String(weight),
          },
        },
      },
    },
  };

  const response = await fetch(`${config.baseUrl}/rating/v2403/Shop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'UPS', ...data };
}

/**
 * Create a UPS shipment.
 * @param {object} shipmentData
 * @returns {Promise<object>}
 */
export async function createShipment(shipmentData) {
  if (!config.clientId) {
    return {
      carrier: 'UPS',
      ShipmentResponse: {
        ShipmentResults: {
          ShipmentIdentificationNumber: `1Z${Date.now()}`,
          PackageResults: { TrackingNumber: `1Z${Date.now()}` },
        },
      },
    };
  }

  const token = await getAccessToken();
  const response = await fetch(`${config.baseUrl}/shipments/v2403/ship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(shipmentData),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'UPS', ...data };
}

/**
 * Track a UPS shipment.
 * @param {string} trackingNumber
 * @returns {Promise<object>}
 */
export async function trackShipment(trackingNumber) {
  if (!config.clientId) {
    return {
      carrier: 'UPS',
      trackingNumber,
      trackResponse: {
        shipment: [
          {
            inquiryNumber: trackingNumber,
            activity: [
              {
                date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
                time: '120000',
                location: { address: { city: 'Hub', countryCode: 'US' } },
                status: { description: 'In Transit', type: 'I' },
              },
            ],
          },
        ],
      },
    };
  }

  const token = await getAccessToken();
  const response = await fetch(
    `${config.baseUrl}/track/v1/details/${encodeURIComponent(trackingNumber)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(config.timeout),
    },
  );
  const data = await response.json();
  return { carrier: 'UPS', ...data };
}

/**
 * Generate a UPS shipping label.
 * @param {string} shipmentId - UPS shipment identification number
 * @returns {Promise<object>}
 */
export async function getLabel(shipmentId) {
  if (!config.clientId) {
    return { carrier: 'UPS', shipmentId, labelUrl: null, format: 'GIF' };
  }

  const token = await getAccessToken();
  const body = {
    LabelRecoveryRequest: {
      Request: { RequestOption: 'TNT', TransactionReference: { CustomerContext: `GlobexSky-${Date.now()}` } },
      TrackingNumber: shipmentId,
    },
  };
  const response = await fetch(`${config.baseUrl}/labels/v2403/recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'UPS', ...data };
}
