/**
 * Globex Sky — payouts.js (admin route)
 * Admin payout management API routes.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/payoutController.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'superadmin'));

router.get('/pending', ctrl.getPendingPayouts);
router.post('/', [body('user_id').isUUID(), body('amount').isFloat({ min: 0.01 }), body('method').notEmpty()], validate, ctrl.createPayout);
router.post('/process/:id', [param('id').isUUID()], validate, ctrl.processPayout);
router.get('/history', ctrl.getPayoutHistory);
router.put('/schedule', ctrl.updatePayoutSchedule);

export default router;
