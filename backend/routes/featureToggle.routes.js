import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/featureToggle.controller.js';

const router = Router();

// Admin-only management routes
router.get('/', authenticate, requireAdmin, ctrl.getToggles);
router.get('/:key', authenticate, requireAdmin, [param('key').notEmpty()], validate, ctrl.getToggle);
router.post('/', authenticate, requireAdmin, [
  body('key').trim().notEmpty().withMessage('key is required'),
  body('name').trim().notEmpty().withMessage('name is required'),
  body('type').optional().isIn(['boolean', 'percentage', 'user_list', 'environment']),
], validate, ctrl.createToggle);
router.patch('/:key', authenticate, requireAdmin, [param('key').notEmpty()], validate, ctrl.updateToggle);
router.delete('/:key', authenticate, requireAdmin, [param('key').notEmpty()], validate, ctrl.deleteToggle);

// Authenticated evaluation
router.post('/:key/evaluate', authenticate, [param('key').notEmpty()], validate, ctrl.evaluateToggle);

export default router;
