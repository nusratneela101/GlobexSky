/**
 * Admin Inspection Management Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/inspectionManagementController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Static /inspections routes first
// GET /api/admin/inspections/queue
router.get('/queue', ctrl.getInspectionQueue);

// GET /api/admin/inspections/pricing
router.get('/pricing', ctrl.getInspectionPricing);

// GET /api/admin/inspections/reports
router.get('/reports', ctrl.getInspectionReports);

// GET /api/admin/inspections/stats
router.get('/stats', ctrl.getInspectionStats);

// PUT /api/admin/inspections/pricing/:type
router.put(
  '/pricing/:type',
  [
    param('type').notEmpty(),
    body('base_price').isFloat({ min: 0 }),
  ],
  validate,
  ctrl.updateInspectionPricing,
);

// POST /api/admin/inspections/:id/assign
router.post('/:id/assign', [param('id').isUUID(), body('inspectorId').isUUID()], validate, ctrl.assignInspector);

export default router;
