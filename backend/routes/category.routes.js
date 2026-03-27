import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/category.controller.js';

const router = Router();

// Public routes
router.get('/', ctrl.listCategories);
router.get('/tree', ctrl.getCategoryTree);
router.get('/slug/:slug', [param('slug').trim().notEmpty()], validate, ctrl.getCategoryBySlug);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getCategory);

// Protected routes
router.post(
  '/',
  authenticate,
  [body('name').trim().notEmpty()],
  validate,
  ctrl.createCategory,
);
router.put('/:id', authenticate, [param('id').notEmpty()], validate, ctrl.updateCategory);
router.delete('/:id', authenticate, [param('id').notEmpty()], validate, ctrl.deleteCategory);
router.patch('/:id/toggle', authenticate, [param('id').notEmpty()], validate, ctrl.toggleCategory);

export default router;
