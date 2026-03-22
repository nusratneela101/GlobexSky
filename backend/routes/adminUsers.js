/**
 * Admin Users Routes
 * Full CRUD + supplier/carrier verification endpoints.
 */

import { Router } from 'express';
import { param, body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/adminUserController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Users
router.get('/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.listUsers,
);
router.get('/export', ctrl.exportUsers);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getUser);
router.put('/:id', [param('id').isUUID()], validate, ctrl.updateUser);
router.put('/:id/role', [param('id').isUUID(), body('role').notEmpty()], validate, ctrl.changeUserRole);
router.put('/:id/status',
  [param('id').isUUID(), body('status').isIn(['active', 'inactive', 'suspended', 'banned'])],
  validate,
  ctrl.changeUserStatus,
);
router.post('/:id/reset-password', [param('id').isUUID()], validate, ctrl.resetUserPassword);
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteUser);

// Supplier verification
router.get('/suppliers/pending', ctrl.listPendingSuppliers);
router.put('/suppliers/:id/verify', [param('id').isUUID()], validate, ctrl.verifySupplier);

// Carrier verification
router.get('/carriers/pending', ctrl.listPendingCarriers);
router.put('/carriers/:id/verify', [param('id').isUUID()], validate, ctrl.verifyCarrier);

export default router;
