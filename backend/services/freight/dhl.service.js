/**
 * Globex Sky — DHL API Service
 * Integrates with DHL's MyDHL+ API for rates, shipment creation, tracking, and labels.
 */

import freightConfig from '../../config/freight.config.js';

const { dhl: config } = freightConfig;

/**
 * Build common DHL request headers.
 */
function getHeaders() {
  const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${credentials}`,
    'Message-Reference': `globexsky-${Date.now()}`,
    'Message-Reference-Date': new Date().toUTCString(),
    'Plugin-Name': 'Globex Sky',
    'Plugin-Version': '1.0',
    'Shipping-System-Platform-Name': 'Globex Sky',
    'Shipping-System-Platform-Version': '1.0',
    'Webstore-Platform-Name': 'Globex Sky',
    'Webstore-Platform-Version': '1.0',
  };
}

/**
 * Get DHL shipping rates.
 * @param {string} origin  - Origin country code (ISO-2)
 * @param {string} destination - Destination country code (ISO-2)
 * @param {number} weight  - Weight in KG
 * @param {{ length: number, width: number, height: number }} dimensions - cm
 * @returns {Promise<object>}
 */
export async function getRates(origin, destination, weight, dimensions) {
  const url = `${config.baseUrl}/rates`;
  const body = {
    customerDetails: {
      shipperDetails: { postalCode: '10001', cityName: 'New York', countryCode: origin },
      receiverDetails: { postalCode: '00100', cityName: 'City', countryCode: destination },
    },
    accounts: [{ typeCode: 'shipper', number: config.apiKey }],
    plannedShippingDateAndTime: new Date().toISOString(),
    unitOfMeasurement: 'metric',
    isCustomsDeclarable: false,
    packages: [
      {
        weight,
        dimensions: {
          length: dimensions?.length || 10,
          width: dimensions?.width || 10,
          height: dimensions?.height || 10,
        },
      },
    ],
  };

  // Return mock data when no credentials configured
  if (!config.apiKey) {
    return {
      carrier: 'DHL',
      products: [
        { productName: 'EXPRESS WORLDWIDE', totalPrice: [{ price: 45.50, priceCurrency: 'USD' }], deliveryCapabilities: { estimatedDeliveryDateAndTime: new Date(Date.now() + 2 * 86400000).toISOString() } },
        { productName: 'EXPRESS 12:00', totalPrice: [{ price: 62.00, priceCurrency: 'USD' }], deliveryCapabilities: { estimatedDeliveryDateAndTime: new Date(Date.now() + 1 * 86400000).toISOString() } },
      ],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'DHL', ...data };
}

/**
 * Create a DHL shipment.
 * @param {object} shipmentData
 * @returns {Promise<object>}
 */
export async function createShipment(shipmentData) {
  const url = `${config.baseUrl}/shipments`;

  if (!config.apiKey) {
    return {
      carrier: 'DHL',
      shipmentTrackingNumber: `DHL${Date.now()}`,
      status: 'created',
      documents: [],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(shipmentData),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'DHL', ...data };
}

/**
 * Track a DHL shipment.
 * @param {string} trackingNumber
 * @returns {Promise<object>}
 */
export async function trackShipment(trackingNumber) {
  const url = `${config.baseUrl}/tracking?trackingNumber=${encodeURIComponent(trackingNumber)}`;

  if (!config.apiKey) {
    return {
      carrier: 'DHL',
      trackingNumber,
      status: 'in-transit',
      events: [
        { timestamp: new Date().toISOString(), location: 'Hub', description: 'Shipment in transit' },
      ],
    };
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'DHL', ...data };
}

/**
 * Generate a DHL shipping label.
 * @param {string} shipmentId
 * @returns {Promise<object>}
 */
export async function getLabel(shipmentId) {
  const url = `${config.baseUrl}/shipments/${encodeURIComponent(shipmentId)}/get-image`;

  if (!config.apiKey) {
    return { carrier: 'DHL', shipmentId, labelUrl: null, format: 'PDF' };
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'DHL', ...data };
}
