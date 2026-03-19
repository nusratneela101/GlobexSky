/**
 * GlobexSky — Freight Routes
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

// GET /api/v1/freight/track/:trackingNumber — Track a shipment (authenticated)
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

export default router;
