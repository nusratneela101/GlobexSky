import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/shipping.controller.js';

const router = Router();

router.post('/rates',                   ctrl.calculateRates);
router.get('/track/:trackingNumber',    ctrl.trackShipment);
router.post('/create',   authenticate, ctrl.createShipment);
router.get('/carriers',                 ctrl.getCarriers);
router.get('/history',   authenticate, ctrl.getShippingHistory);
router.get('/methods',                  ctrl.getShippingMethods);

export default router;
