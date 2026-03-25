/**
 * Admin Settings Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/settingsController.js';
const router = Router();
router.use(authenticate, requireAdmin);

// ─── Existing settings routes ─────────────────────────────────────────────────
router.get('/', ctrl.getAllSettings);
router.put('/general', ctrl.updateGeneralSettings);
router.put('/email', ctrl.updateEmailSettings);
router.post('/email/test', ctrl.sendTestEmail);
router.put('/sms', ctrl.updateSmsSettings);
router.put('/payment', ctrl.updatePaymentSettings);
router.put('/shipping', ctrl.updateShippingSettings);
router.put('/storage', ctrl.updateStorageSettings);
router.put('/security', ctrl.updateSecuritySettings);
router.put('/seo', ctrl.updateSeoSettings);
router.get('/languages', ctrl.getLanguages);
router.post('/languages', ctrl.addLanguage);
router.get('/currencies', ctrl.getCurrencies);
router.post('/currencies', ctrl.addCurrency);
router.post('/backup', ctrl.createBackup);
router.get('/backups', ctrl.listBackups);
router.post('/restore/:id', [param('id').isUUID()], validate, ctrl.restoreBackup);

// ─── Platform API-key / service settings routes ───────────────────────────────
// GET    /platform                          — get all service settings (all categories)
// GET    /platform/:category                — get settings for one category
// PUT    /platform/:category                — upsert settings for a category
// POST   /platform/toggle-mode              — toggle global test / live mode
// POST   /platform/:category/toggle-mode    — toggle mode for a specific category
// POST   /platform/test-connection          — test connectivity for a service

router.get('/platform',               ctrl.getPlatformSettings);
router.post('/platform/toggle-mode',  ctrl.togglePlatformMode);
router.post('/platform/test-connection',
  [body('category').notEmpty().withMessage('category is required')],
  validate,
  ctrl.testPlatformConnection,
);
// NOTE: /platform/:category/toggle-mode must be registered before /platform/:category
// so Express matches the specific "toggle-mode" suffix before the wildcard :category route.
router.post('/platform/:category/toggle-mode', ctrl.toggleCategoryMode);
router.get('/platform/:category',     ctrl.getPlatformCategory);
router.put('/platform/:category',
  [
    body('mode').optional().isIn(['test', 'live']).withMessage('mode must be "test" or "live"'),
    body('settings').isObject().withMessage('settings must be an object'),
  ],
  validate,
  ctrl.updatePlatformCategory,
);

export default router;
