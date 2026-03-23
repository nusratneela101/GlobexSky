import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier } from '../middleware/roleCheck.js';

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     tags: [Products]
 *     summary: List products
 *     description: Returns a paginated list of active products with optional filters.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, rating] }
 *     responses:
 *       200:
 *         description: Products list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
 *     description: Returns full product details including supplier info and reviews.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     description: Creates a new product listing. Requires supplier authentication.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, price, category_id]
 *             properties:
 *               title: { type: string, example: Premium Widget }
 *               description: { type: string }
 *               price: { type: number, format: float, example: 29.99 }
 *               currency: { type: string, default: USD }
 *               category_id: { type: string, format: uuid }
 *               stock_quantity: { type: integer, example: 100 }
 *               images: { type: array, items: { type: string, format: uri } }
 *     responses:
 *       201:
 *         description: Product created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Supplier role required
 */

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
