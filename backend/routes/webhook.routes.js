import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/webhook.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listWebhooks);
router.post('/', [body('url').isURL(), body('events').isArray({ min: 1 })], validate, ctrl.createWebhook);
router.put('/:id', [param('id').isUUID()], validate, ctrl.updateWebhook);
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteWebhook);
router.post('/:id/test', [param('id').isUUID()], validate, ctrl.testWebhook);

export default router;
