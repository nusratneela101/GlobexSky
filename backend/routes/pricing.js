/**
 * Globex Sky — pricing.js (admin route)
 * Admin pricing & commission management API routes.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/pricingController.js';

const router = Router();

// All admin pricing routes require authentication and admin role
router.use(authenticate, requireRole('admin', 'superadmin'));

/* ─── Commission Settings ─────────────────────────────────────────────── */
router.get('/commissions', ctrl.getCommissions);
router.put('/commissions', [body('settings').isArray()], validate, ctrl.updateCommissions);

/* ─── Supplier Plans ──────────────────────────────────────────────────── */
router.get('/supplier-plans', ctrl.getSupplierPlans);
router.post('/supplier-plans', [body('name').notEmpty(), body('monthly_fee').isFloat({ min: 0 })], validate, ctrl.createSupplierPlan);
router.put('/supplier-plans/:id', [param('id').isUUID()], validate, ctrl.updateSupplierPlan);
router.delete('/supplier-plans/:id', [param('id').isUUID()], validate, ctrl.deleteSupplierPlan);

/* ─── Inspection Pricing ──────────────────────────────────────────────── */
router.get('/inspection', ctrl.getInspectionPricing);
router.put('/inspection', [body('items').isArray()], validate, ctrl.updateInspectionPricing);

/* ─── Dropshipping Markup ─────────────────────────────────────────────── */
router.get('/dropshipping', ctrl.getDropshippingMarkup);
router.put('/dropshipping', [body('items').isArray()], validate, ctrl.updateDropshippingMarkup);

/* ─── Carry Service Rates ─────────────────────────────────────────────── */
router.get('/carry-service', ctrl.getCarryRates);
router.put('/carry-service', [body('items').isArray()], validate, ctrl.updateCarryRates);

/* ─── Parcel Service Pricing ──────────────────────────────────────────── */
router.get('/parcel-service', ctrl.getParcelPricing);
router.put('/parcel-service', [body('items').isArray()], validate, ctrl.updateParcelPricing);

/* ─── API Pricing Tiers ───────────────────────────────────────────────── */
router.get('/api-plans', ctrl.getApiPricingTiers);
router.put('/api-plans', [body('items').isArray()], validate, ctrl.updateApiPricingTiers);

export default router;
