import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);
router.get('/stats', ctrl.getDashboardStats);

// Users
router.get('/users', ctrl.listUsers);
router.post('/users', ctrl.createUser);
router.get('/users/:id', [param('id').isUUID()], validate, ctrl.getUser);
router.patch('/users/:id', [param('id').isUUID()], validate, ctrl.updateUser);
router.put('/users/:id', [param('id').isUUID()], validate, ctrl.updateUser);
router.put('/users/:id/role', [param('id').isUUID(), body('role').notEmpty()], validate, ctrl.updateUserRole);
router.put('/users/:id/status', [param('id').isUUID(), body('status').notEmpty()], validate, ctrl.updateUserStatus);
router.delete('/users/:id', [param('id').isUUID()], validate, ctrl.deleteUser);

// Orders
router.get('/orders', ctrl.listAllOrders);
router.put('/orders/:id/status', [param('id').isUUID(), body('status').notEmpty()], validate, ctrl.updateOrderStatus);
router.post('/orders/:id/refund', [param('id').isUUID()], validate, ctrl.refundOrder);

// Products
router.get('/products', ctrl.listAllProducts);
router.post('/products', ctrl.createProduct);
router.put('/products/:id', [param('id').isUUID()], validate, ctrl.updateProduct);
router.delete('/products/:id', [param('id').isUUID()], validate, ctrl.deleteProduct);
router.patch('/products/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateProductStatus,
);
router.put('/products/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateProductStatus,
);

// Analytics
router.get('/analytics', ctrl.getAnalytics);

// Categories
router.get('/categories', ctrl.listCategories);
router.post('/categories', ctrl.createCategory);
router.put('/categories/:id', [param('id').isUUID()], validate, ctrl.updateCategory);
router.delete('/categories/:id', [param('id').isUUID()], validate, ctrl.deleteCategory);

// Transactions
router.get('/transactions', ctrl.listAllTransactions);

// Suppliers
router.get('/suppliers', ctrl.listSuppliers);
router.patch('/suppliers/:id/verify', [param('id').isUUID()], validate, ctrl.verifySupplier);

// Settings
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);
router.get('/site-settings', ctrl.getSiteSettings);
router.put('/site-settings', ctrl.updateSiteSettings);

// Feature toggles
router.get('/feature-toggles', ctrl.getFeatureToggles);
router.put('/feature-toggles', ctrl.updateFeatureToggle);

export default router;
