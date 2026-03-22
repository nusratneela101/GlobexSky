/**
 * CMS Routes (Admin)
 * Manage pages, banners, blog posts, and media.
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { uploadGeneral } from '../middleware/upload.js';
import * as ctrl from '../controllers/cmsController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Pages
router.get('/pages', ctrl.listPages);
router.post('/pages', [body('slug').notEmpty(), body('title').notEmpty()], validate, ctrl.createPage);
router.get('/pages/:id', ctrl.getPage);
router.put('/pages/:id', ctrl.updatePage);
router.delete('/pages/:id', ctrl.deletePage);

// Banners
router.get('/banners', ctrl.listBanners);
router.post('/banners', [body('title').notEmpty(), body('image_url').notEmpty()], validate, ctrl.createBanner);
router.put('/banners/:id', [param('id').isUUID()], validate, ctrl.updateBanner);
router.delete('/banners/:id', [param('id').isUUID()], validate, ctrl.deleteBanner);

// Blog
router.get('/blog', ctrl.listBlogPosts);
router.post('/blog', [body('title').notEmpty(), body('slug').notEmpty()], validate, ctrl.createBlogPost);
router.get('/blog/:id', [param('id').isUUID()], validate, ctrl.getBlogPost);
router.put('/blog/:id', [param('id').isUUID()], validate, ctrl.updateBlogPost);
router.delete('/blog/:id', [param('id').isUUID()], validate, ctrl.deleteBlogPost);

// Media upload
router.post('/media/upload', uploadGeneral.single('file'), ctrl.uploadMedia);

export default router;
