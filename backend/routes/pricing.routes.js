import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/pricing.controller.js';

const router = Router();

// Public pricing reads
router.get('/shipping-rates', ctrl.getShippingRates);
router.get('/carry-rates', ctrl.getCarryRates);
router.get('/inspection-pricing', ctrl.getInspectionPricing);
router.get('/supplier-plans', ctrl.getSupplierPlans);
router.get('/api-plans', ctrl.getApiPlans);
router.get('/advertising-pricing', ctrl.getAdvertisingPricing);

// Pricing calculations (authenticated)
router.post('/calculate/commission', authenticate, ctrl.calculateCommission);
router.post('/calculate/shipping', ctrl.calculateShipping);
router.post('/calculate/carry', ctrl.calculateCarryPayment);
router.post('/calculate/markup', ctrl.calculateDropshippingMarkup);

// Admin: manage pricing settings
router.put('/commission-settings', authenticate, requireAdmin, ctrl.updateCommissionSettings);
router.put('/shipping-rates/:id', authenticate, requireAdmin, ctrl.updateShippingRate);
router.put('/supplier-plans/:id', authenticate, requireAdmin, ctrl.updateSupplierPlan);

export default router;
