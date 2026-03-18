import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/shipment.controller.js';

const router = Router();

router.get('/rates', ctrl.getShippingRates);
router.post('/calculate', authenticate, ctrl.calculateShippingCost);

export default router;
