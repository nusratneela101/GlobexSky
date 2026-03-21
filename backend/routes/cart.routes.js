import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/cart.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.getCart);
router.get('/saved', ctrl.getSavedItems);

router.post('/add',
  [
    body('product_id').notEmpty().withMessage('product_id is required.'),
    body('quantity').optional().isInt({ min: 1 }),
  ],
  validate,
  ctrl.addToCart,
);

router.put('/update/:itemId',
  [
    param('itemId').notEmpty(),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1.'),
  ],
  validate,
  ctrl.updateCartItem,
);

router.delete('/remove/:itemId',
  [param('itemId').notEmpty()],
  validate,
  ctrl.removeCartItem,
);

router.post('/save-for-later/:itemId',
  [param('itemId').notEmpty()],
  validate,
  ctrl.saveForLater,
);

router.post('/apply-coupon',
  [
    body('code').notEmpty().withMessage('Coupon code is required.'),
    body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be a non-negative number.'),
  ],
  validate,
  ctrl.applyCoupon,
);

export default router;
