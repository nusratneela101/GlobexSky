import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/order.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listOrders);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getOrder);
router.post('/',
  [body('items').isArray({ min: 1 }), body('shipping_address_id').isUUID()],
  validate,
  ctrl.createOrder,
);
router.patch('/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateOrderStatus,
);
router.post('/:id/cancel', [param('id').isUUID()], validate, ctrl.cancelOrder);
router.get('/:id/tracking', [param('id').isUUID()], validate, ctrl.getOrderTracking);

export default router;
