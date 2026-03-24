/**
 * Admin Marketing Management Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/marketingManagementController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/marketing/leads
router.get('/leads', ctrl.getLeads);

// POST /api/admin/marketing/campaigns
router.post('/campaigns', [body('name').notEmpty()], validate, ctrl.createCampaign);

// GET /api/admin/marketing/campaigns
router.get('/campaigns', ctrl.getCampaigns);

// PUT /api/admin/marketing/campaigns/:id/status
router.put(
  '/campaigns/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateCampaignStatus,
);

// GET /api/admin/marketing/upgrade-requests
router.get('/upgrade-requests', ctrl.getSupplierUpgradeRequests);

// POST /api/admin/marketing/approve-upgrade
router.post(
  '/approve-upgrade',
  [body('supplierId').isUUID(), body('plan').notEmpty()],
  validate,
  ctrl.approveUpgrade,
);

// GET /api/admin/marketing/stats
router.get('/stats', ctrl.getMarketingStats);

// POST /api/admin/marketing/bulk-email
router.post(
  '/bulk-email',
  [body('template').notEmpty(), body('recipients').isArray({ min: 1 })],
  validate,
  ctrl.sendBulkEmail,
);

export default router;
