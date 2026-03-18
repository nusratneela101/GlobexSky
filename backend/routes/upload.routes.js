import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import { uploadProduct, uploadAvatar, uploadDocument, uploadBanner, uploadGeneral } from '../middleware/upload.js';
import * as ctrl from '../controllers/upload.controller.js';

const router = Router();

router.use(authenticate, uploadRateLimiter);

router.post('/product-image', uploadProduct.single('file'), ctrl.uploadFile);
router.post('/product-images', uploadProduct.array('files', 10), ctrl.uploadMultipleFiles);
router.post('/avatar', uploadAvatar.single('file'), ctrl.uploadFile);
router.post('/document', uploadDocument.single('file'), ctrl.uploadFile);
router.post('/banner', uploadBanner.single('file'), ctrl.uploadFile);
router.post('/general', uploadGeneral.single('file'), ctrl.uploadFile);
router.delete('/:publicId', ctrl.deleteFile);

export default router;
