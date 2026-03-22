/**
 * Admin Products Routes
 * Full CRUD + moderation + category management.
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/adminProductController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Products
router.get('/', ctrl.listProducts);
router.get('/pending', ctrl.listPendingProducts);
router.post('/bulk-import', ctrl.bulkImportProducts);
router.put('/bulk-update', ctrl.bulkUpdateProducts);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getProduct);
router.put('/:id', [param('id').isUUID()], validate, ctrl.updateProduct);
router.put('/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.changeProductStatus,
);
router.put('/:id/approve', [param('id').isUUID()], validate, ctrl.approveProduct);
router.put('/:id/reject', [param('id').isUUID()], validate, ctrl.rejectProduct);
router.put('/:id/feature', [param('id').isUUID()], validate, ctrl.toggleFeatured);
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteProduct);

// Categories
router.get('/categories', ctrl.listCategories);
router.post('/categories', [body('name').notEmpty(), body('slug').notEmpty()], validate, ctrl.createCategory);
router.put('/categories/:id', [param('id').isUUID()], validate, ctrl.updateCategory);
router.delete('/categories/:id', [param('id').isUUID()], validate, ctrl.deleteCategory);

export default router;
