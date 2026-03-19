import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/seo.controller.js';

const router = Router();

// Public
router.get('/sitemap.xml', ctrl.generateSitemap);
router.get('/robots.txt', ctrl.getRobotsTxt);
router.get('/meta/:pageSlug', [param('pageSlug').trim().notEmpty()], validate, ctrl.getMetaTags);

// Admin
router.patch('/meta/:pageSlug', authenticate, requireAdmin, [
  param('pageSlug').trim().notEmpty(),
  body('title').optional().trim(),
  body('description').optional().trim(),
  body('keywords').optional().trim(),
], validate, ctrl.updateMetaTags);

router.get('/audit', authenticate, requireAdmin, ctrl.getSeoAudit);
router.get('/analytics', authenticate, requireAdmin, ctrl.getSeoAnalytics);

export default router;
