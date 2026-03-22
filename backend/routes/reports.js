/**
 * Globex Sky — reports.js (admin route)
 * Financial reports API routes.
 */

import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/reportController.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'superadmin'));

router.get('/revenue', ctrl.getRevenueReport);
router.get('/profit-loss', ctrl.getProfitLossReport);
router.get('/commissions', ctrl.getCommissionReport);
router.get('/payouts', ctrl.getPayoutSummary);
router.get('/transactions', ctrl.getAllTransactions);
router.get('/export/:type', [param('type').isIn(['revenue', 'commissions', 'transactions', 'payouts'])], validate, ctrl.exportReport);

export default router;
