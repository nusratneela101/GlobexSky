import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/smsTemplate.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.post(
  '/calculate-segments',
  [body('text').notEmpty()],
  validate,
  ctrl.calculateSegments,
);

router.get('/', ctrl.listSmsTemplates);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getSmsTemplate);

router.post(
  '/',
  [body('name').notEmpty(), body('body').notEmpty()],
  validate,
  ctrl.createSmsTemplate,
);

router.put('/:id', [param('id').notEmpty()], validate, ctrl.updateSmsTemplate);
router.delete('/:id', [param('id').notEmpty()], validate, ctrl.deleteSmsTemplate);

router.post('/:id/clone', [param('id').notEmpty()], validate, ctrl.cloneSmsTemplate);

router.post(
  '/:id/preview',
  [param('id').notEmpty(), body('values').optional().isObject()],
  validate,
  ctrl.previewSmsTemplate,
);

export default router;
