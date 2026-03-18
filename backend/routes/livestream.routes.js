import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupplier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/livestream.controller.js';

const router = Router();

router.get('/', ctrl.listLivestreams);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getLivestream);

router.post('/', authenticate, requireSupplier, ctrl.createLivestream);
router.patch('/:id/start', authenticate, requireSupplier, [param('id').isUUID()], validate, ctrl.startLivestream);
router.patch('/:id/end', authenticate, requireSupplier, [param('id').isUUID()], validate, ctrl.endLivestream);
router.delete('/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.deleteLivestream);

export default router;
