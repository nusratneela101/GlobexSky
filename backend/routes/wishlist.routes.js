import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/wishlist.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listWishlist);

router.post('/',
  [body('product_id').notEmpty().withMessage('product_id is required.')],
  validate,
  ctrl.addToWishlist,
);

router.delete('/:productId',
  [param('productId').notEmpty()],
  validate,
  ctrl.removeFromWishlist,
);

router.post('/:productId/move-to-cart',
  [
    param('productId').notEmpty(),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer.'),
  ],
  validate,
  ctrl.moveToCart,
);

export default router;
