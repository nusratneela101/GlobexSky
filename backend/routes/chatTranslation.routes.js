/**
 * Chat Translation Routes
 * Base path: /api/v1/translation (registered in server.js)
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/chatTranslation.controller.js';

const router = Router();

// ─── Public / Authenticated routes ──────────────────────────────────────────

/** POST /api/v1/translation/translate — Translate text */
router.post(
  '/translate',
  authenticate,
  [
    body('text').notEmpty().withMessage('text is required'),
    body('target_language').notEmpty().withMessage('target_language is required'),
  ],
  validate,
  ctrl.translate,
);

/** POST /api/v1/translation/detect — Detect language */
router.post(
  '/detect',
  authenticate,
  [body('text').notEmpty().withMessage('text is required')],
  validate,
  ctrl.detect,
);

/** GET /api/v1/translation/languages — List supported languages */
router.get('/languages', ctrl.languages);

/** GET /api/v1/translation/history/:messageId — Get translation history */
router.get(
  '/history/:messageId',
  authenticate,
  [param('messageId').isUUID().withMessage('Valid message UUID required')],
  validate,
  ctrl.getTranslationHistory,
);

// ─── Admin routes ───────────────────────────────────────────────────────────

/** GET /api/v1/translation/config — Get all config (admin) */
router.get('/config', authenticate, requireAdmin, ctrl.getConfig);

/** PUT /api/v1/translation/config — Update config (admin) */
router.put('/config', authenticate, requireAdmin, ctrl.updateConfig);

/** POST /api/v1/translation/config/test — Test provider connection (admin) */
router.post(
  '/config/test',
  authenticate,
  requireAdmin,
  [body('provider').notEmpty().withMessage('provider is required')],
  validate,
  ctrl.testConnection,
);

export default router;
