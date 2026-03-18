import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/apiPlatform.controller.js';

const router = Router();

router.use(authenticate);

router.get('/keys', ctrl.listApiKeys);
router.post('/keys', [body('plan_id').isUUID()], validate, ctrl.createApiKey);
router.delete('/keys/:id', ctrl.revokeApiKey);
router.get('/usage', ctrl.getApiUsage);
router.get('/plans', ctrl.getApiPlans);
router.get('/logs', ctrl.getApiLogs);
router.get('/webhooks', ctrl.listWebhooks);
router.post('/webhooks', [body('url').isURL(), body('events').isArray()], validate, ctrl.createWebhook);
router.delete('/webhooks/:id', ctrl.deleteWebhook);

export default router;
