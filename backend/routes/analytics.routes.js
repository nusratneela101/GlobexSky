import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/analytics.controller.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', ctrl.getDashboardStats);
router.get('/sales', [query('start').optional().isISO8601(), query('end').optional().isISO8601()], validate, ctrl.getSalesReport);
router.get('/users', requireAdmin, ctrl.getUserAnalytics);
router.get('/products', ctrl.getProductAnalytics);
router.get('/shipments', ctrl.getShipmentAnalytics);
router.get('/financials', requireAdmin, ctrl.getFinancialReport);

export default router;
