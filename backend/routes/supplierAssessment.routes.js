/**
 * Globex Sky — Supplier Assessment Routes
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/supplierAssessment.controller.js';

const router = Router();

// GET /leaderboard — public (no auth required)
router.get('/leaderboard', [query('limit').optional().isInt({ min: 1, max: 100 })], validate, ctrl.getLeaderboard);

// POST /:supplierId/assess — admin
router.post(
  '/:supplierId/assess',
  authenticate,
  requireAdmin,
  [
    param('supplierId').isUUID(),
    body('quality').isFloat({ min: 0, max: 100 }),
    body('delivery').isFloat({ min: 0, max: 100 }),
    body('communication').isFloat({ min: 0, max: 100 }),
    body('compliance').isFloat({ min: 0, max: 100 }),
  ],
  validate,
  ctrl.assessSupplier,
);

// GET /:supplierId/scorecard — authenticated
router.get(
  '/:supplierId/scorecard',
  authenticate,
  [param('supplierId').isUUID()],
  validate,
  ctrl.getScorecard,
);

// PATCH /:supplierId/scorecard — admin
router.patch(
  '/:supplierId/scorecard',
  authenticate,
  requireAdmin,
  [
    param('supplierId').isUUID(),
    body('quality').isFloat({ min: 0, max: 100 }),
    body('delivery').isFloat({ min: 0, max: 100 }),
    body('communication').isFloat({ min: 0, max: 100 }),
    body('compliance').isFloat({ min: 0, max: 100 }),
  ],
  validate,
  ctrl.updateScorecard,
);

// POST /:supplierId/badge — admin
router.post(
  '/:supplierId/badge',
  authenticate,
  requireAdmin,
  [
    param('supplierId').isUUID(),
    body('badgeType').notEmpty().withMessage('badgeType is required'),
  ],
  validate,
  ctrl.awardBadge,
);

// GET /:supplierId/verification — authenticated
router.get(
  '/:supplierId/verification',
  authenticate,
  [param('supplierId').isUUID()],
  validate,
  ctrl.getVerificationStatusHandler,
);

export default router;
