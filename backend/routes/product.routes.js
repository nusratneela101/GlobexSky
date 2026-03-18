import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier } from '../middleware/roleCheck.js';
import { uploadProduct } from '../middleware/upload.js';
import * as ctrl from '../controllers/product.controller.js';

const router = Router();

// Public routes
router.get('/', ctrl.listProducts);
router.get('/search', [query('q').trim().notEmpty()], validate, ctrl.searchProducts);
router.get('/categories', ctrl.listCategories);
router.get('/featured', ctrl.getFeaturedProducts);
router.get('/trending', ctrl.getTrendingProducts);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getProduct);

// Protected routes
router.post('/',
  authenticate, requireSupplier,
  uploadProduct.array('images', 10),
  [body('title').trim().notEmpty(), body('price').isFloat({ min: 0 }), body('category_id').isUUID()],
  validate,
  ctrl.createProduct,
);

router.put('/:id',
  authenticate, requireSupplier,
  [param('id').isUUID()],
  validate,
  ctrl.updateProduct,
);

router.delete('/:id',
  authenticate, requireSupplier,
  [param('id').isUUID()],
  validate,
  ctrl.deleteProduct,
);

router.post('/:id/wishlist', authenticate, [param('id').isUUID()], validate, ctrl.toggleWishlist);

export default router;
