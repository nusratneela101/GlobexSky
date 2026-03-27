import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/emailTemplate.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get(
  '/',
  [
    query('search').optional(),
    query('category').optional(),
    query('isActive').optional(),
    query('page').optional(),
    query('limit').optional(),
  ],
  validate,
  ctrl.listEmailTemplates,
);

router.get('/:id', [param('id').notEmpty()], validate, ctrl.getEmailTemplate);

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('subject').notEmpty(),
    body('body').notEmpty(),
  ],
  validate,
  ctrl.createEmailTemplate,
);

router.put('/:id', [param('id').notEmpty()], validate, ctrl.updateEmailTemplate);
router.delete('/:id', [param('id').notEmpty()], validate, ctrl.deleteEmailTemplate);

router.post('/:id/clone', [param('id').notEmpty()], validate, ctrl.cloneEmailTemplate);

router.post(
  '/:id/preview',
  [param('id').notEmpty(), body('values').optional().isObject()],
  validate,
  ctrl.previewEmailTemplate,
);

router.get('/:id/versions', [param('id').notEmpty()], validate, ctrl.getEmailTemplateVersions);

router.post(
  '/:id/versions/:version/restore',
  [param('id').notEmpty(), param('version').isInt()],
  validate,
  ctrl.restoreEmailTemplateVersion,
);

export default router;
