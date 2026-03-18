import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', ctrl.getDashboardStats);
router.get('/users', ctrl.listUsers);
router.get('/users/:id', [param('id').isUUID()], validate, ctrl.getUser);
router.patch('/users/:id', [param('id').isUUID()], validate, ctrl.updateUser);
router.delete('/users/:id', [param('id').isUUID()], validate, ctrl.deleteUser);

router.get('/orders', ctrl.listAllOrders);
router.get('/products', ctrl.listAllProducts);
router.patch('/products/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateProductStatus,
);

router.get('/transactions', ctrl.listAllTransactions);
router.get('/suppliers', ctrl.listSuppliers);
router.patch('/suppliers/:id/verify', [param('id').isUUID()], validate, ctrl.verifySupplier);

router.get('/site-settings', ctrl.getSiteSettings);
router.put('/site-settings', ctrl.updateSiteSettings);
router.get('/feature-toggles', ctrl.getFeatureToggles);
router.put('/feature-toggles', ctrl.updateFeatureToggle);

export default router;
