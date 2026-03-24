/**
 * Admin Carrier Catalog Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/carrierCatalogController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Static routes must come before parameterized routes
// GET /api/admin/carrier-catalog/bonus-rules
router.get('/bonus-rules', ctrl.getBonusRules);

// PUT /api/admin/carrier-catalog/bonus-rules
router.put('/bonus-rules', [body('rules').isArray()], validate, ctrl.setBonusRules);

// GET /api/admin/carrier-catalog/payments/:carrierId
router.get('/payments/:carrierId', [param('carrierId').isUUID()], validate, ctrl.getCarrierPaymentHistory);

// GET /api/admin/carrier-catalog
router.get('/', ctrl.getCarrierProducts);

// POST /api/admin/carrier-catalog
router.post(
  '/',
  [body('name').notEmpty(), body('rate_per_kg').isFloat({ min: 0 })],
  validate,
  ctrl.createCarrierProduct,
);

// PUT /api/admin/carrier-catalog/:id
router.put('/:id', [param('id').isUUID()], validate, ctrl.updateCarrierProduct);

// DELETE /api/admin/carrier-catalog/:id
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteCarrierProduct);

// PUT /api/admin/carrier-catalog/:id/surge-rules
router.put(
  '/:id/surge-rules',
  [param('id').isUUID(), body('rules').isArray()],
  validate,
  ctrl.setSurgeRules,
);

export default router;
