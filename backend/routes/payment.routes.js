import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/payment.controller.js';

const router = Router();

router.use(authenticate);

router.get('/transactions', ctrl.listTransactions);
router.get('/transactions/:id', [param('id').isUUID()], validate, ctrl.getTransaction);
router.post('/checkout', [body('order_id').isUUID(), body('payment_method').notEmpty()], validate, ctrl.processPayment);
router.post('/refund', [body('transaction_id').isUUID(), body('reason').notEmpty()], validate, ctrl.requestRefund);
router.get('/methods', ctrl.getPaymentMethods);

export default router;
