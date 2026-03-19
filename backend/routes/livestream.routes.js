import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupplier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/livestream.controller.js';

const router = Router();

// ─── Public Routes ───────────────────────────────────────────────────────────
router.get('/active', ctrl.getActiveStreams);
router.get('/', ctrl.listLivestreams);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getStreamDetails);

// ─── Authenticated Routes ────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('category').optional().isString(),
    body('scheduled_at').optional().isISO8601(),
  ],
  validate,
  ctrl.createStream,
);

router.patch(
  '/:id/start',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.startStream,
);

router.patch(
  '/:id/end',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.endStream,
);

router.post(
  '/:id/products',
  authenticate,
  [
    param('id').isUUID(),
    body('product_id').isUUID().withMessage('Valid product_id is required'),
    body('featured_price').optional().isFloat({ gt: 0 }),
  ],
  validate,
  ctrl.addStreamProduct,
);

router.post(
  '/:id/chat',
  authenticate,
  [
    param('id').isUUID(),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 500 }),
  ],
  validate,
  ctrl.sendStreamMessage,
);

router.get(
  '/:id/analytics',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.getStreamAnalyticsHandler,
);

router.delete('/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.deleteLivestream);

export default router;

