import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/advertising.controller.js';

const router = Router();

// Public — record impressions/clicks (called client-side)
router.post('/impression', ctrl.recordImpression);
router.post('/click', ctrl.recordClick);

// Supplier — manage own ads
router.get('/my', authenticate, ctrl.getMyAds);
router.get('/my/analytics', authenticate, ctrl.getAdAnalytics);
router.post(
  '/',
  authenticate,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('ad_type').isIn(['featured', 'banner', 'sponsored', 'search']).withMessage('Invalid ad type'),
    body('budget').isFloat({ gt: 0 }).withMessage('Budget must be positive'),
    body('start_date').isISO8601().withMessage('Invalid start date'),
    body('end_date').isISO8601().withMessage('Invalid end date'),
  ],
  validate,
  ctrl.createAd,
);
router.put('/:id', authenticate, [param('id').isUUID()], validate, ctrl.updateAd);
router.delete('/:id', authenticate, [param('id').isUUID()], validate, ctrl.deleteAd);

// Admin — manage all ads
router.get('/', authenticate, requireAdmin, ctrl.listAds);
router.get('/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.getAd);
router.put('/:id/approve', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.approveAd);
router.put(
  '/:id/reject',
  authenticate,
  requireAdmin,
  [param('id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.rejectAd,
);

export default router;
