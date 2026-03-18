import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/campaign.controller.js';

const router = Router();

// Public
router.get('/', ctrl.listActiveCampaigns);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getCampaign);

// Admin
router.post('/', authenticate, requireAdmin, ctrl.createCampaign);
router.put('/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.updateCampaign);
router.delete('/:id', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.deleteCampaign);
router.post('/:id/products', authenticate, requireAdmin, [param('id').isUUID()], validate, ctrl.addCampaignProducts);

export default router;
