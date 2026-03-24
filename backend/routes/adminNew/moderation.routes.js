/**
 * Admin Content Moderation Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/contentModerationController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/moderation/queue
router.get('/queue', ctrl.getModerationQueue);

// POST /api/admin/moderation/:id/approve
router.post('/:id/approve', [param('id').isUUID()], validate, ctrl.approveContent);

// POST /api/admin/moderation/:id/reject
router.post(
  '/:id/reject',
  [param('id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.rejectContent,
);

// POST /api/admin/moderation/:id/flag
router.post(
  '/:id/flag',
  [param('id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.flagContent,
);

// GET /api/admin/moderation/reported
router.get('/reported', ctrl.getReportedContent);

// GET /api/admin/moderation/banned-words
router.get('/banned-words', ctrl.getBannedWords);

// PUT /api/admin/moderation/banned-words
router.put(
  '/banned-words',
  [
    body('add').optional().isArray(),
    body('remove').optional().isArray(),
  ],
  validate,
  ctrl.updateBannedWords,
);

// GET /api/admin/moderation/auto-rules
router.get('/auto-rules', ctrl.getAutoModerationRules);

// POST /api/admin/moderation/auto-rules
router.post(
  '/auto-rules',
  [body('name').notEmpty(), body('trigger_type').notEmpty(), body('action').notEmpty()],
  validate,
  ctrl.setAutoModerationRule,
);

// GET /api/admin/moderation/stats
router.get('/stats', ctrl.getModerationStats);

export default router;
