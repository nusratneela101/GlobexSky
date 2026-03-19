/**
 * Globex Sky — Aramex API Service
 * Integrates with Aramex Shipping API v2 for rates, shipment creation, and tracking.
 */

import freightConfig from '../../config/freight.config.js';

const { aramex: config } = freightConfig;

/**
 * Build the Aramex ClientInfo object used in every request.
 */
function clientInfo() {
  return {
    UserName: config.username,
    Password: config.password,
    Version: 'v1',
    AccountNumber: config.accountNumber,
    AccountPin: config.accountPin,
    AccountEntity: config.accountEntity,
    AccountCountryCode: config.accountCountryCode,
    Source: 24,
  };
}

/**
 * Get Aramex shipping rates.
 * @param {string} origin  - Origin country code (ISO-2)
 * @param {string} destination - Destination country code (ISO-2)
 * @param {number} weight  - Weight in KG
 * @param {{ length: number, width: number, height: number }} dimensions - cm
 * @returns {Promise<object>}
 */
export async function getRates(origin, destination, weight, dimensions) {
  if (!config.username) {
    return {
      carrier: 'Aramex',
      TotalAmount: { Value: 38.50, CurrencyCode: 'USD' },
      RateDetails: [
        { ProductGroup: 'EXP', ProductType: 'PPX', TotalAmount: { Value: 38.50, CurrencyCode: 'USD' }, DeliveryDays: '3-5' },
      ],
    };
  }

  const body = {
    ClientInfo: clientInfo(),
    Transaction: { Reference1: `Globex Sky-${Date.now()}` },
    OriginAddress: { Line1: 'Origin', City: 'City', CountryCode: origin },
    DestinationAddress: { Line1: 'Destination', City: 'City', CountryCode: destination },
    ShipmentDetails: {
      Dimensions: { Length: dimensions?.length || 10, Width: dimensions?.width || 10, Height: dimensions?.height || 10, Unit: 'CM' },
      ActualWeight: { Value: weight, Unit: 'KG' },
      ChargeableWeight: null,
      DescriptionOfGoods: 'General Goods',
      GoodsOriginCountry: origin,
      NumberOfPieces: 1,
      ProductGroup: 'EXP',
      ProductType: 'PPX',
      PaymentType: 'P',
      PaymentOptions: '',
    },
  };

  const response = await fetch(`${config.baseUrl}/RateCalculator/Service_1_0.svc/json/CalculateRate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'Aramex', ...data };
}

/**
 * Create an Aramex shipment.
 * @param {object} shipmentData
 * @returns {Promise<object>}
 */
export async function createShipment(shipmentData) {
  if (!config.username) {
    return {
      carrier: 'Aramex',
      Shipments: [{ ID: `ARX${Date.now()}`, ForeignHAWB: null, HasErrors: false }],
      Notifications: [],
    };
  }

  const body = {
    ClientInfo: clientInfo(),
    Transaction: { Reference1: `Globex Sky-${Date.now()}` },
    Shipments: Array.isArray(shipmentData) ? shipmentData : [shipmentData],
    LabelInfo: { ReportID: 9201, ReportType: 'URL' },
  };

  const response = await fetch(`${config.baseUrl}/Shipping/Service_1_0.svc/json/CreateShipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'Aramex', ...data };
}

/**
 * Track an Aramex shipment.
 * @param {string} trackingNumber
 * @returns {Promise<object>}
 */
export async function trackShipment(trackingNumber) {
  if (!config.username) {
    return {
      carrier: 'Aramex',
      trackingNumber,
      TrackingResults: [
        {
          Value: [
            {
              WaybillNumber: trackingNumber,
              UpdateDescription: 'Shipment in transit',
              UpdateDateTime: new Date().toISOString(),
              UpdateLocation: 'Hub',
            },
          ],
        },
      ],
    };
  }

  const body = {
    ClientInfo: clientInfo(),
    Transaction: { Reference1: `Globex Sky-${Date.now()}` },
    Shipments: [trackingNumber],
    GetLastTrackingUpdateOnly: false,
  };

  const response = await fetch(`${config.baseUrl}/Tracking/Service_1_0.svc/json/TrackShipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  });
  const data = await response.json();
  return { carrier: 'Aramex', ...data };
}
