/**
 * customStyle.routes.js
 * Routes for Custom CSS/JS Admin Panel
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/customStyle.controller.js';

const router = Router();

// ─── Public endpoints (for frontend to fetch active styles) ─────────────────
router.get('/active', ctrl.getActiveStyles);
router.get('/css', ctrl.serveCSS);
router.get('/js', ctrl.serveJS);

// ─── Admin-only CRUD endpoints ──────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requireAdmin,
  ctrl.listStyles
);

router.get(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid style ID')],
  validate,
  ctrl.getStyle
);

router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 255 }).withMessage('Name is too long'),
    body('css_content').optional().isString().isLength({ max: 500000 }).withMessage('CSS content is too large (max 500KB)'),
    body('js_content').optional().isString().isLength({ max: 500000 }).withMessage('JS content is too large (max 500KB)'),
    body('is_active').optional().isBoolean(),
    body('applied_pages').optional().isString().isLength({ max: 2000 }).withMessage('Applied pages list is too long')
  ],
  validate,
  ctrl.createStyle
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid style ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 255 }).withMessage('Name is too long'),
    body('css_content').optional().isString().isLength({ max: 500000 }).withMessage('CSS content is too large (max 500KB)'),
    body('js_content').optional().isString().isLength({ max: 500000 }).withMessage('JS content is too large (max 500KB)'),
    body('is_active').optional().isBoolean(),
    body('applied_pages').optional().isString().isLength({ max: 2000 }).withMessage('Applied pages list is too long')
  ],
  validate,
  ctrl.updateStyle
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid style ID')],
  validate,
  ctrl.deleteStyle
);

router.patch(
  '/:id/toggle',
  authenticate,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid style ID')],
  validate,
  ctrl.toggleStyle
);

export default router;
