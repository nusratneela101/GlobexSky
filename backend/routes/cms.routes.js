import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/cms.controller.js';

const router = Router();

// Public
router.get('/pages', ctrl.listPages);
router.get('/pages/:slug', ctrl.getPage);
router.get('/banners', ctrl.listBanners);
router.get('/blog', ctrl.listBlogPosts);
router.get('/blog/:slug', ctrl.getBlogPost);
router.get('/faqs', ctrl.listFAQs);

// Admin
router.post('/pages', authenticate, requireAdmin, ctrl.createPage);
router.put('/pages/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.updatePage);
router.delete('/pages/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.deletePage);
router.post('/banners', authenticate, requireAdmin, ctrl.createBanner);
router.put('/banners/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.updateBanner);
router.post('/blog', authenticate, requireAdmin, ctrl.createBlogPost);
router.put('/blog/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.updateBlogPost);
router.post('/faqs', authenticate, requireAdmin, ctrl.createFAQ);
router.put('/faqs/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.updateFAQ);

export default router;
