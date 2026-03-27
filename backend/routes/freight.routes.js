/**
 * Globex Sky — Freight Routes
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/freight.controller.js';

const router = Router();

// POST /api/v1/freight/compare-rates — Compare rates across carriers (authenticated)
router.post(
  '/compare-rates',
  authenticate,
  [
    body('origin').isLength({ min: 2, max: 3 }).withMessage('origin must be a 2-3 char country code'),
    body('destination').isLength({ min: 2, max: 3 }).withMessage('destination must be a 2-3 char country code'),
    body('weight').isFloat({ min: 0.01 }).withMessage('weight must be a positive number'),
    body('dimensions').optional().isObject(),
  ],
  validate,
  ctrl.compareRates,
);

// POST /api/v1/freight/book — Book a shipment (authenticated)
router.post(
  '/book',
  authenticate,
  [
    body('carrier').isIn(['dhl', 'fedex', 'aramex']).withMessage('carrier must be dhl, fedex, or aramex'),
    body('shipmentData').isObject().withMessage('shipmentData is required'),
  ],
  validate,
  ctrl.bookShipment,
);

// GET /api/v1/freight/analytics — Freight analytics (admin only)
router.get(
  '/analytics',
  authenticate,
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getFreightAnalytics,
);

/* ═══════════════════════════════════════════════════════
   FREIGHT SHIPMENT MANAGEMENT
═══════════════════════════════════════════════════════ */

// GET /api/v1/freight/dashboard — Freight dashboard summary (admin)
router.get(
  '/dashboard',
  authenticate,
  requireAdmin,
  ctrl.getFreightDashboard,
);

// GET /api/v1/freight/containers/:containerNumber/track — Track by container number (public)
router.get(
  '/containers/:containerNumber/track',
  [
    param('containerNumber').notEmpty().withMessage('containerNumber is required'),
  ],
  validate,
  ctrl.trackContainer,
);

// POST /api/v1/freight/shipments — Create freight shipment (admin)
router.post(
  '/shipments',
  authenticate,
  requireAdmin,
  [
    body('carrier_name').notEmpty().withMessage('carrier_name is required'),
    body('origin_port').notEmpty().withMessage('origin_port is required'),
    body('destination_port').notEmpty().withMessage('destination_port is required'),
    body('freight_type').isIn(['FCL', 'LCL', 'air', 'rail']).withMessage('freight_type must be FCL, LCL, air, or rail'),
    body('container_number').optional().isString(),
    body('bill_of_lading').optional().isString(),
    body('departure_date').optional().isISO8601(),
    body('estimated_arrival').optional().isISO8601(),
    body('weight').optional().isFloat({ min: 0 }),
    body('volume').optional().isFloat({ min: 0 }),
    body('customs_status').optional().isString(),
  ],
  validate,
  ctrl.createFreightShipment,
);

// GET /api/v1/freight/shipments — List freight shipments (authenticated)
router.get(
  '/shipments',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['booked', 'in_transit', 'at_port', 'customs', 'delivered']),
  ],
  validate,
  ctrl.listFreightShipments,
);

// GET /api/v1/freight/shipments/:id — Get freight shipment details (authenticated)
router.get(
  '/shipments/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getFreightShipment,
);

// PUT /api/v1/freight/shipments/:id — Update freight shipment (admin)
router.put(
  '/shipments/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('status').optional().isIn(['booked', 'in_transit', 'at_port', 'customs', 'delivered']),
    body('freight_type').optional().isIn(['FCL', 'LCL', 'air', 'rail']),
    body('carrier_name').optional().isString(),
    body('origin_port').optional().isString(),
    body('destination_port').optional().isString(),
    body('departure_date').optional().isISO8601(),
    body('estimated_arrival').optional().isISO8601(),
    body('actual_arrival').optional().isISO8601(),
    body('weight').optional().isFloat({ min: 0 }),
    body('volume').optional().isFloat({ min: 0 }),
    body('customs_status').optional().isString(),
    body('bill_of_lading').optional().isString(),
    body('container_number').optional().isString(),
  ],
  validate,
  ctrl.updateFreightShipment,
);

// POST /api/v1/freight/shipments/:id/tracking — Add tracking update (admin)
router.post(
  '/shipments/:id/tracking',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('location').notEmpty().withMessage('location is required'),
    body('status').notEmpty().withMessage('status is required'),
    body('description').optional().isString(),
    body('lat').optional().isFloat({ min: -90, max: 90 }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  ctrl.addTrackingUpdate,
);

// GET /api/v1/freight/shipments/:id/tracking — Get tracking history (authenticated)
router.get(
  '/shipments/:id/tracking',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getTrackingHistory,
);

// POST /api/v1/freight/shipments/:id/documents — Add document to shipment (admin)
router.post(
  '/shipments/:id/documents',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('name').notEmpty().withMessage('name is required'),
    body('type').notEmpty().withMessage('type is required'),
    body('url').optional().isString(),
    body('size').optional().isString(),
  ],
  validate,
  ctrl.addShipmentDocument,
);

// GET /api/v1/freight/track/:trackingNumber — Track a shipment via carrier API (authenticated)
router.get(
  '/track/:trackingNumber',
  authenticate,
  [
    param('trackingNumber').notEmpty().withMessage('trackingNumber is required'),
    query('carrier').optional().isIn(['dhl', 'fedex', 'aramex']),
  ],
  validate,
  ctrl.trackFreight,
);

export default router;
