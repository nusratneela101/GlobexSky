import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/blogPost.controller.js';

const router = Router();

// Public routes
router.get(
  '/',
  [
    query('status').optional(),
    query('category').optional(),
    query('tag').optional(),
    query('page').optional(),
    query('limit').optional(),
  ],
  validate,
  ctrl.listBlogPosts,
);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getBlogPost);

// Protected routes
router.post(
  '/',
  authenticate,
  [body('title').trim().notEmpty(), body('content').notEmpty()],
  validate,
  ctrl.createBlogPost,
);
router.put('/:id', authenticate, [param('id').notEmpty()], validate, ctrl.updateBlogPost);
router.delete('/:id', authenticate, [param('id').notEmpty()], validate, ctrl.deleteBlogPost);
router.patch('/:id/publish', authenticate, [param('id').notEmpty()], validate, ctrl.publishBlogPost);

export default router;
