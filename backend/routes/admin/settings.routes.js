/**
 * backend/routes/admin/settings.routes.js
 * Admin platform settings management endpoints.
 *
 * All routes require admin authentication.
 *
 * GET  /api/v1/admin/settings/platform              — Get all service settings (all categories)
 * GET  /api/v1/admin/settings/platform/mode         — Get current global mode (test/live)
 * GET  /api/v1/admin/settings/platform/:category    — Get settings for one category
 * PUT  /api/v1/admin/settings/platform/:category    — Save/update settings for a category
 * POST /api/v1/admin/settings/platform/toggle-mode  — Toggle global test/live mode
 * POST /api/v1/admin/settings/platform/:cat/toggle-mode — Toggle per-category mode
 * POST /api/v1/admin/settings/platform/test-connection  — Test connectivity for a service
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import {
  getPlatformSettings,
  getPlatformMode,
  getPlatformCategory,
  updatePlatformCategory,
  togglePlatformMode,
  toggleCategoryMode,
  testPlatformConnection,
} from '../../controllers/settingsController.js';

const router = Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// GET /platform — all settings grouped by category
// (relative to mount point; full path: /api/v1/admin/settings/platform)
router.get('/', getPlatformSettings);

// GET /platform/mode — current global mode
// NOTE: Must be registered before /:category to avoid "mode" being treated as a category param.
router.get('/mode', getPlatformMode);

// POST /platform/toggle-mode — toggle global test/live mode
// NOTE: Must be before /:category/toggle-mode to avoid route conflict.
router.post('/toggle-mode', togglePlatformMode);

// POST /platform/test-connection — test a service's connectivity
router.post(
  '/test-connection',
  [body('category').notEmpty().withMessage('category is required')],
  validate,
  testPlatformConnection,
);

// POST /platform/:category/toggle-mode — toggle per-category mode
// NOTE: Must be before /:category to avoid "toggle-mode" being swallowed as a category name.
router.post('/:category/toggle-mode', toggleCategoryMode);

// GET /platform/:category — settings for a single category
router.get('/:category', getPlatformCategory);

// PUT /platform/:category — upsert settings for a category
router.put(
  '/:category',
  [
    body('mode').optional().isIn(['test', 'live']).withMessage('mode must be "test" or "live"'),
    body('settings').isObject().withMessage('settings must be an object'),
  ],
  validate,
  updatePlatformCategory,
);

export default router;
