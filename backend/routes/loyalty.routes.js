import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/loyalty.controller.js';

const router = Router();

router.use(authenticate);

router.post('/enroll', ctrl.enrollMember);
router.get('/points', ctrl.getPoints);

router.post(
  '/earn',
  [
    body('action').isIn(['purchase', 'review', 'referral', 'signup']).withMessage('Invalid action'),
    body('purchase_amount').optional().isFloat({ min: 0 }),
    body('reference_id').optional().isString(),
  ],
  validate,
  ctrl.earnPoints,
);

router.post(
  '/redeem',
  [
    body('points').isInt({ gt: 0 }).withMessage('points must be a positive integer'),
    body('reward_id').isUUID().withMessage('Valid reward_id is required'),
    body('description').optional().isString(),
  ],
  validate,
  ctrl.redeemPoints,
);

router.get('/tier', ctrl.getMemberTier);
router.get('/rewards', ctrl.getAvailableRewards);
router.get('/analytics', requireAdmin, ctrl.getLoyaltyAnalytics);

export default router;
