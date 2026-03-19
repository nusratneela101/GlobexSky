/**
 * GlobexSky — Freight Controller
 * Handles freight rate comparison, booking, tracking, and analytics.
 */

import supabase from '../config/supabase.js';
import * as dhl from '../services/freight/dhl.service.js';
import * as fedex from '../services/freight/fedex.service.js';
import * as aramex from '../services/freight/aramex.service.js';

/**
 * POST /api/v1/freight/compare-rates
 * Compare rates across DHL, FedEx, Aramex for given shipment params.
 */
export async function compareRates(req, res, next) {
  try {
    const { origin, destination, weight, dimensions } = req.body;

    const [dhlRates, fedexRates, aramexRates] = await Promise.allSettled([
      dhl.getRates(origin, destination, +weight, dimensions),
      fedex.getRates(origin, destination, +weight, dimensions),
      aramex.getRates(origin, destination, +weight, dimensions),
    ]);

    const results = {
      dhl: dhlRates.status === 'fulfilled' ? dhlRates.value : { carrier: 'DHL', error: dhlRates.reason?.message },
      fedex: fedexRates.status === 'fulfilled' ? fedexRates.value : { carrier: 'FedEx', error: fedexRates.reason?.message },
      aramex: aramexRates.status === 'fulfilled' ? aramexRates.value : { carrier: 'Aramex', error: aramexRates.reason?.message },
    };

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/freight/book
 * Book a shipment with the selected carrier.
 */
export async function bookShipment(req, res, next) {
  try {
    const { carrier, shipmentData } = req.body;
    const userId = req.user.id;

    let result;
    switch (carrier?.toLowerCase()) {
      case 'dhl':
        result = await dhl.createShipment(shipmentData);
        break;
      case 'fedex':
        result = await fedex.createShipment(shipmentData);
        break;
      case 'aramex':
        result = await aramex.createShipment(shipmentData);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid carrier. Choose dhl, fedex, or aramex.' });
    }

    // Persist booking record
    const trackingNumber =
      result?.shipmentTrackingNumber ||
      result?.output?.transactionShipments?.[0]?.masterTrackingNumber ||
      result?.Shipments?.[0]?.ID ||
      null;

    const { data: booking, error } = await supabase
      .from('freight_bookings')
      .insert({
        user_id: userId,
        carrier: carrier.toLowerCase(),
        tracking_number: trackingNumber,
        shipment_data: shipmentData,
        carrier_response: result,
        status: 'booked',
      })
      .select()
      .single();

    if (error) {
      // Non-fatal: return carrier result even if DB insert fails
      return res.status(201).json({ success: true, data: { carrier_response: result, tracking_number: trackingNumber } });
    }

    res.status(201).json({ success: true, data: { booking, carrier_response: result, tracking_number: trackingNumber } });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/track/:trackingNumber
 * Track a freight shipment. Auto-detect carrier from number format or accept query param.
 */
export async function trackFreight(req, res, next) {
  try {
    const { trackingNumber } = req.params;
    const carrier = req.query.carrier?.toLowerCase();

    let carrierToUse = carrier;
    if (!carrierToUse) {
      // Auto-detect by tracking number pattern
      if (/^\d{10}$/.test(trackingNumber)) carrierToUse = 'dhl';
      else if (/^\d{12,15}$/.test(trackingNumber)) carrierToUse = 'fedex';
      else if (/^[A-Z]{1,3}\d{8,}/.test(trackingNumber)) carrierToUse = 'aramex';
      else carrierToUse = 'dhl'; // default
    }

    let result;
    switch (carrierToUse) {
      case 'dhl':
        result = await dhl.trackShipment(trackingNumber);
        break;
      case 'fedex':
        result = await fedex.trackShipment(trackingNumber);
        break;
      case 'aramex':
        result = await aramex.trackShipment(trackingNumber);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown carrier.' });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/analytics
 * Shipping analytics — cost trends, carrier usage, delivery performance.
 */
export async function getFreightAnalytics(req, res, next) {
  try {
    const { start, end } = req.query;

    let query = supabase
      .from('freight_bookings')
      .select('carrier,status,created_at,shipment_data');

    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, message: error.message });

    const bookings = data || [];
    const byCarrier = bookings.reduce((acc, b) => {
      acc[b.carrier] = (acc[b.carrier] || 0) + 1;
      return acc;
    }, {});

    const byStatus = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total_bookings: bookings.length,
        by_carrier: byCarrier,
        by_status: byStatus,
      },
    });
  } catch (err) { next(err); }
}
