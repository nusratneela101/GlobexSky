import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/templateController.js';

const router = Router();

// All template routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── Utility endpoints (no :id — must come first) ────────────────────────────

/** POST /api/v1/templates/preview-raw — render a template string without saving */
router.post(
  '/preview-raw',
  [body('body').notEmpty().withMessage('body is required')],
  validate,
  ctrl.renderPreviewRaw,
);

/** POST /api/v1/templates/sms-segments — calculate SMS segment count */
router.post(
  '/sms-segments',
  [body('text').notEmpty().withMessage('text is required')],
  validate,
  ctrl.smsSegments,
);

// ─── Collection routes ────────────────────────────────────────────────────────

/** GET /api/v1/templates */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['email', 'sms']),
    query('is_active').optional().isBoolean(),
  ],
  validate,
  ctrl.listTemplates,
);

/** POST /api/v1/templates */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('type').isIn(['email', 'sms']).withMessage('type must be email or sms'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('body').notEmpty().withMessage('body is required'),
    body('subject').if(body('type').equals('email')).notEmpty().withMessage('subject is required for email templates'),
  ],
  validate,
  ctrl.createTemplate,
);

// ─── Single-resource routes ───────────────────────────────────────────────────

/** GET /api/v1/templates/:id */
router.get('/:id', [param('id').isUUID()], validate, ctrl.getTemplate);

/** PUT /api/v1/templates/:id */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['email', 'sms']),
    body('category').optional().trim().notEmpty(),
    body('body').optional().notEmpty(),
    // subject is required only when explicitly setting type to 'email'
    body('subject')
      .if(body('type').equals('email'))
      .optional()
      .notEmpty()
      .withMessage('subject cannot be empty for email templates'),
  ],
  validate,
  ctrl.updateTemplate,
);

/** DELETE /api/v1/templates/:id */
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteTemplate);

/** PATCH /api/v1/templates/:id/toggle — enable/disable */
router.patch('/:id/toggle', [param('id').isUUID()], validate, ctrl.toggleTemplate);

/** POST /api/v1/templates/:id/preview */
router.post('/:id/preview', [param('id').isUUID()], validate, ctrl.renderPreview);

/** POST /api/v1/templates/:id/test-send */
router.post(
  '/:id/test-send',
  [
    param('id').isUUID(),
    body('to').notEmpty().withMessage('"to" is required'),
  ],
  validate,
  ctrl.testSend,
);

/** POST /api/v1/templates/:id/clone */
router.post('/:id/clone', [param('id').isUUID()], validate, ctrl.cloneTemplate);

/** GET /api/v1/templates/:id/versions */
router.get('/:id/versions', [param('id').isUUID()], validate, ctrl.getVersionHistory);

/** POST /api/v1/templates/:id/versions/:version/restore */
router.post(
  '/:id/versions/:version/restore',
  [param('id').isUUID(), param('version').isInt({ min: 1 })],
  validate,
  ctrl.restoreVersion,
);

export default router;
