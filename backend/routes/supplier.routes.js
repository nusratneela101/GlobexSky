import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/supplier.controller.js';

const router = Router();

// Public supplier info
router.get('/:id', ctrl.getSupplierProfile);
router.get('/:id/products', ctrl.getSupplierProducts);

// Supplier-only dashboard routes
router.get('/dashboard/stats', authenticate, requireSupplier, ctrl.getDashboardStats);
router.put('/dashboard/profile', authenticate, requireSupplier, ctrl.updateSupplierProfile);
router.get('/dashboard/orders', authenticate, requireSupplier, ctrl.getSupplierOrders);
router.get('/dashboard/analytics', authenticate, requireSupplier, ctrl.getSupplierAnalytics);
router.get('/dashboard/earnings', authenticate, requireSupplier, ctrl.getSupplierEarnings);

export default router;
