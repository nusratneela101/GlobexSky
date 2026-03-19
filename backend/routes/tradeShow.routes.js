import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/tradeShow.controller.js';

const router = Router();

// POST /api/v1/trade-shows — Create a trade show (admin)
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('title').notEmpty().withMessage('title is required'),
    body('start_date').isISO8601().withMessage('start_date must be a valid date'),
    body('end_date').isISO8601().withMessage('end_date must be a valid date'),
    body('description').optional().isString(),
    body('location_type').optional().isIn(['virtual', 'hybrid', 'in-person']),
    body('tags').optional().isArray(),
  ],
  validate,
  ctrl.createTradeShow,
);

// GET /api/v1/trade-shows — List trade shows (public)
router.get(
  '/',
  [
    query('status').optional().isIn(['upcoming', 'active', 'past', 'closed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getTradeShows,
);

// POST /api/v1/trade-shows/:id/booths — Register a booth (authenticated)
router.post(
  '/:id/booths',
  authenticate,
  [
    param('id').isUUID(),
    body('booth_size').optional().isIn(['small', 'standard', 'large', 'premium']),
    body('brand_description').optional().isString(),
    body('product_categories').optional().isArray(),
    body('contact_email').optional().isEmail(),
  ],
  validate,
  ctrl.registerBooth,
);

// GET /api/v1/trade-shows/:id/booths/:boothId — Get booth details (public)
router.get(
  '/:id/booths/:boothId',
  [param('id').isUUID(), param('boothId').isUUID()],
  validate,
  ctrl.getBoothDetails,
);

// POST /api/v1/trade-shows/:id/demos — Schedule a demo (authenticated)
router.post(
  '/:id/demos',
  authenticate,
  [
    param('id').isUUID(),
    body('title').notEmpty().withMessage('title is required'),
    body('scheduled_at').isISO8601().withMessage('scheduled_at must be a valid date'),
    body('booth_id').optional().isUUID(),
    body('description').optional().isString(),
    body('duration_minutes').optional().isInt({ min: 5, max: 480 }),
  ],
  validate,
  ctrl.scheduleDemo,
);

// POST /api/v1/trade-shows/:id/meetings — Create/update a meeting (authenticated)
router.post(
  '/:id/meetings',
  authenticate,
  [
    param('id').isUUID(),
    body('scheduled_at').isISO8601().withMessage('scheduled_at must be a valid date'),
    body('attendee_id').optional().isUUID(),
    body('meeting_id').optional().isUUID(),
    body('duration_minutes').optional().isInt({ min: 5, max: 480 }),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.manageMeetings,
);

export default router;
