import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/dropshipping.controller.js';

const router = Router();

router.use(authenticate);

// Dashboard & inventory
router.get('/dashboard', ctrl.getDashboard);
router.get('/inventory', ctrl.getInventorySync);
router.post('/sync', ctrl.syncInventory);

// Product catalog & import
router.get('/products', ctrl.listDropshippingProducts);
router.post('/import', ctrl.importProduct);
router.get('/imported', ctrl.listImportedProducts);
router.delete('/imported/:id', ctrl.removeProduct);
router.put('/imported/:id/pricing', ctrl.updatePricing);

// Markup settings
router.get('/markups', ctrl.getMarkupSettings);
router.put('/markups', ctrl.updateMarkupSettings);

// Orders
router.get('/orders', ctrl.getDropshipOrders);
router.post('/orders/:order_id/route', ctrl.routeOrderToSupplier);

// Analytics
router.get('/analytics', ctrl.getAnalytics);

// Suppliers
router.get('/suppliers', ctrl.getConnectedSuppliers);

// Settings
router.put('/settings', ctrl.updateSettings);

export default router;
