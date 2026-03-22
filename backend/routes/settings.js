/**
 * Admin Settings Routes
 */

import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/settingsController.js';

const router = Router();
router.use(authenticate, requireAdmin);

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

export default router;
