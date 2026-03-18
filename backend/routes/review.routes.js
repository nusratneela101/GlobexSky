import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/review.controller.js';

const router = Router();

router.get('/product/:productId', [param('productId').isUUID()], validate, ctrl.getProductReviews);
router.post('/',
  authenticate,
  [
    body('product_id').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
  ],
  validate,
  ctrl.createReview,
);
router.put('/:id', authenticate, [param('id').isUUID()], validate, ctrl.updateReview);
router.delete('/:id', authenticate, [param('id').isUUID()], validate, ctrl.deleteReview);
router.post('/:id/helpful', authenticate, [param('id').isUUID()], validate, ctrl.markHelpful);

export default router;
