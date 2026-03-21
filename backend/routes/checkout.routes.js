import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/checkout.controller.js';

const router = Router();

router.use(authenticate);

router.post('/validate', ctrl.validateCart);

router.post('/shipping-rates',
  [
    body('country').notEmpty().withMessage('Country is required.'),
    body('subtotal').isFloat({ min: 0 }),
  ],
  validate,
  ctrl.getShippingRates,
);

router.post('/place-order',
  [
    body('shipping_address_id').notEmpty().withMessage('Shipping address is required.'),
    body('payment_method').notEmpty().withMessage('Payment method is required.'),
  ],
  validate,
  ctrl.placeOrder,
);

router.get('/confirmation/:orderId',
  [param('orderId').notEmpty()],
  validate,
  ctrl.getOrderConfirmation,
);

export default router;
