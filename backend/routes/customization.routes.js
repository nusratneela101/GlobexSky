import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/customization.controller.js';

const router = Router();

router.use(authenticate);

// ─── Config routes (must come BEFORE /:id wildcard) ─────────────────────────

/** GET /api/v1/customization/config — admin: get all config */
router.get('/config', requireAdmin, ctrl.getConfig);

/** PUT /api/v1/customization/config — admin: update config */
router.put('/config', requireAdmin, ctrl.updateConfig);

/** GET /api/v1/customization/buyer/my — buyer: get my requests */
router.get(
  '/buyer/my',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft','submitted','quoted','accepted','in_production','completed','cancelled']),
  ],
  validate,
  ctrl.getBuyerRequests,
);

/** GET /api/v1/customization/supplier/my — supplier: get received requests */
router.get(
  '/supplier/my',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft','submitted','quoted','accepted','in_production','completed','cancelled']),
  ],
  validate,
  ctrl.getSupplierRequests,
);

// ─── Request CRUD ─────────────────────────────────────────────────────────────

/** POST /api/v1/customization — create request */
router.post(
  '/',
  [
    body('title').notEmpty().trim(),
    body('supplier_id').optional({ nullable: true }).isUUID(),
    body('product_id').optional({ nullable: true }).isUUID(),
    body('quantity').optional({ nullable: true }).isInt({ min: 1 }),
    body('target_price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('target_date').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  ctrl.createRequest,
);

/** GET /api/v1/customization/:id — get request details */
router.get('/:id', [param('id').isUUID()], validate, ctrl.getRequest);

/** PUT /api/v1/customization/:id — update draft request */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('title').optional().notEmpty().trim(),
    body('quantity').optional({ nullable: true }).isInt({ min: 1 }),
    body('target_price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('target_date').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  ctrl.updateRequest,
);

/** PUT /api/v1/customization/:id/submit — submit request to suppliers */
router.put('/:id/submit', [param('id').isUUID()], validate, ctrl.submitRequest);

// ─── Quote routes ─────────────────────────────────────────────────────────────

/** POST /api/v1/customization/:id/quotes — supplier submit quote */
router.post(
  '/:id/quotes',
  [
    param('id').isUUID(),
    body('unit_price').isFloat({ min: 0 }),
    body('total_price').isFloat({ min: 0 }),
    body('moq').optional({ nullable: true }).isInt({ min: 1 }),
    body('lead_time_days').optional({ nullable: true }).isInt({ min: 1 }),
    body('valid_until').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  ctrl.submitQuote,
);

/** PUT /api/v1/customization/:id/quotes/:quoteId/accept — buyer accept quote */
router.put(
  '/:id/quotes/:quoteId/accept',
  [param('id').isUUID(), param('quoteId').isUUID()],
  validate,
  ctrl.acceptQuote,
);

/** PUT /api/v1/customization/:id/quotes/:quoteId/reject — buyer reject quote */
router.put(
  '/:id/quotes/:quoteId/reject',
  [param('id').isUUID(), param('quoteId').isUUID()],
  validate,
  ctrl.rejectQuote,
);

// ─── Message routes ───────────────────────────────────────────────────────────

/** POST /api/v1/customization/:id/messages — send message */
router.post(
  '/:id/messages',
  [
    param('id').isUUID(),
    body('message').notEmpty().trim(),
    body('attachments').optional().isArray(),
  ],
  validate,
  ctrl.sendMessage,
);

/** GET /api/v1/customization/:id/messages — get messages */
router.get(
  '/:id/messages',
  [
    param('id').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getMessages,
);

export default router;
