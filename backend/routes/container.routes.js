import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import Container from '../models/Container.js';
import FreightBooking from '../models/FreightBooking.js';

const router = Router();

/* ═══════════════════════════════════════════════════════
   CONTAINERS
═══════════════════════════════════════════════════════ */

/**
 * GET /api/v1/containers
 * List containers (admin) or search by query.
 */
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await Container.findAll({ page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/containers/track/:containerNumber
 * Public: track a container by number.
 */
router.get('/track/:containerNumber', async (req, res, next) => {
  try {
    const container = await Container.findByContainerNumber(req.params.containerNumber);
    if (!container) return res.status(404).json({ success: false, error: 'Container not found' });
    res.json({ success: true, data: container });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/containers/:id
 */
router.get('/:id', param('id').isUUID(), validate, async (req, res, next) => {
  try {
    const container = await Container.findById(req.params.id);
    if (!container) return res.status(404).json({ success: false, error: 'Container not found' });
    res.json({ success: true, data: container });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/containers  (admin)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('container_number').isString().notEmpty().withMessage('container_number is required'),
    body('type').isString().notEmpty().withMessage('type is required'),
    body('size').isString().notEmpty().withMessage('size is required'),
    body('origin_port').isString().notEmpty().withMessage('origin_port is required'),
    body('destination_port').isString().notEmpty().withMessage('destination_port is required'),
    body('carrier').optional().isString(),
    body('booking_reference').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const container = await Container.create({
        ...req.body,
        container_number: req.body.container_number.toUpperCase(),
        status: req.body.status || 'booked',
      });
      res.status(201).json({ success: true, data: container });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/containers/:id/status  (admin)
 * Update container status and location.
 */
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('status').isString().notEmpty().withMessage('status is required'),
    body('current_location').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const container = await Container.updateStatus(req.params.id, req.body.status, req.body.current_location);
      res.json({ success: true, data: container });
    } catch (err) {
      next(err);
    }
  },
);

/* ═══════════════════════════════════════════════════════
   FREIGHT BOOKINGS
═══════════════════════════════════════════════════════ */

/**
 * GET /api/v1/containers/bookings  (authenticated)
 */
router.get('/bookings/mine', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await FreightBooking.findByShipper(req.user.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/containers/bookings  (authenticated)
 * Create a new freight booking.
 */
router.post(
  '/bookings',
  authenticate,
  [
    body('freight_type').isIn(['FCL', 'LCL', 'AIR', 'RAIL']).withMessage('Invalid freight_type'),
    body('origin').isString().notEmpty().withMessage('origin is required'),
    body('destination').isString().notEmpty().withMessage('destination is required'),
    body('cargo_description').isString().notEmpty().withMessage('cargo_description is required'),
    body('weight_kg').isFloat({ gt: 0 }).withMessage('weight_kg must be positive'),
    body('incoterms').optional().isString(),
    body('pickup_date').optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const ref = `FB-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const booking = await FreightBooking.create({
        ...req.body,
        booking_reference: ref,
        shipper_id: req.user.id,
        status: 'pending',
        tracking_events: [],
      });
      res.status(201).json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/containers/bookings/:id/events  (admin)
 * Add tracking event to a booking.
 */
router.post(
  '/bookings/:id/events',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('event_type').isString().notEmpty().withMessage('event_type is required'),
    body('description').isString().notEmpty().withMessage('description is required'),
    body('location').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const booking = await FreightBooking.addTrackingEvent(req.params.id, {
        event_type: req.body.event_type,
        description: req.body.description,
        location: req.body.location,
      });
      res.json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
