/**
 * Globex Sky — Freight Controller
 * Handles freight rate comparison, booking, tracking, and analytics,
 * as well as freight shipment management and container tracking.
 */

import supabase from '../config/supabase.js';
import * as dhl from '../services/freight/dhl.service.js';
import * as fedex from '../services/freight/fedex.service.js';
import * as aramex from '../services/freight/aramex.service.js';
import FreightShipment from '../models/FreightShipment.js';
import ContainerTracking from '../models/ContainerTracking.js';

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

/* ═══════════════════════════════════════════════════════
   FREIGHT SHIPMENT MANAGEMENT
═══════════════════════════════════════════════════════ */

/**
 * POST /api/v1/freight/shipments
 * Create a new freight shipment.
 */
export async function createFreightShipment(req, res, next) {
  try {
    const {
      order_id, container_number, bill_of_lading, carrier_name,
      origin_port, destination_port, departure_date, estimated_arrival,
      freight_type, weight, volume, customs_status,
    } = req.body;

    const shipment = await FreightShipment.create({
      order_id: order_id || null,
      container_number: container_number ? container_number.toUpperCase() : null,
      bill_of_lading: bill_of_lading || null,
      carrier_name,
      origin_port,
      destination_port,
      departure_date: departure_date || null,
      estimated_arrival: estimated_arrival || null,
      actual_arrival: null,
      status: 'booked',
      tracking_updates: [],
      freight_type,
      weight: weight || null,
      volume: volume || null,
      customs_status: customs_status || 'pending',
      documents: [],
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/shipments
 * List freight shipments (admin sees all, user sees own if order_id linked).
 */
export async function listFreightShipments(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const status = req.query.status;

    const filters = {};
    if (status) filters.status = status;

    const result = await FreightShipment.findAll({ page, limit, filters });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/shipments/:id
 * Get a single freight shipment by ID.
 */
export async function getFreightShipment(req, res, next) {
  try {
    const shipment = await FreightShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/freight/shipments/:id
 * Update a freight shipment.
 */
export async function updateFreightShipment(req, res, next) {
  try {
    const allowed = [
      'carrier_name', 'origin_port', 'destination_port', 'departure_date',
      'estimated_arrival', 'actual_arrival', 'status', 'freight_type',
      'weight', 'volume', 'customs_status', 'bill_of_lading', 'container_number',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    if (updates.container_number) {
      updates.container_number = updates.container_number.toUpperCase();
    }
    const shipment = await FreightShipment.update(req.params.id, updates);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/freight/shipments/:id/tracking
 * Add a tracking update to a freight shipment.
 */
export async function addTrackingUpdate(req, res, next) {
  try {
    const { location, status, description, lat, lng } = req.body;

    // Add to the tracking_updates JSON array on the shipment
    const shipment = await FreightShipment.addTrackingUpdate(req.params.id, {
      location, status, description, lat, lng,
    });

    // Also insert into container_tracking table for queryable history
    await ContainerTracking.addEvent(req.params.id, {
      location, status, description, lat, lng,
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/shipments/:id/tracking
 * Get tracking history for a freight shipment.
 */
export async function getTrackingHistory(req, res, next) {
  try {
    const shipment = await FreightShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    const events = await ContainerTracking.findByShipmentId(req.params.id);
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/containers/:containerNumber/track
 * Track a container by its container number.
 */
export async function trackContainer(req, res, next) {
  try {
    const { containerNumber } = req.params;
    const shipment = await FreightShipment.findByContainerNumber(containerNumber);

    if (!shipment) {
      // Also try bill of lading as fallback
      const byBol = await FreightShipment.findByBillOfLading(containerNumber);
      if (!byBol) return res.status(404).json({ success: false, message: 'Container not found' });
      const events = await ContainerTracking.findByShipmentId(byBol.id);
      return res.json({ success: true, data: { shipment: byBol, tracking: events } });
    }

    const events = await ContainerTracking.findByShipmentId(shipment.id);
    res.json({ success: true, data: { shipment, tracking: events } });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/freight/shipments/:id/documents
 * Add a document reference to a freight shipment.
 */
export async function addShipmentDocument(req, res, next) {
  try {
    const { name, type, url, size } = req.body;
    const shipment = await FreightShipment.addDocument(req.params.id, { name, type, url, size });
    res.status(201).json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/freight/dashboard
 * Freight dashboard summary: totals, status breakdown, freight type breakdown.
 */
export async function getFreightDashboard(req, res, next) {
  try {
    const summary = await FreightShipment.getDashboardSummary();

    // Also include legacy freight_bookings count for backwards compatibility
    const { count: legacyCount } = await supabase
      .from('freight_bookings')
      .select('*', { count: 'exact', head: true });

    res.json({
      success: true,
      data: {
        ...summary,
        legacy_bookings_count: legacyCount ?? 0,
      },
    });
  } catch (err) { next(err); }
}
