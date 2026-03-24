/**
 * Admin Inspectors Routes
 * Mounted separately at /api/admin/inspectors
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/inspectionManagementController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/inspectors
router.get('/', ctrl.getInspectors);

// POST /api/admin/inspectors
router.post(
  '/',
  [body('name').notEmpty(), body('email').isEmail()],
  validate,
  ctrl.createInspector,
);

// PUT /api/admin/inspectors/:id/availability
router.put(
  '/:id/availability',
  [param('id').isUUID()],
  validate,
  ctrl.updateInspectorAvailability,
);

export default router;
