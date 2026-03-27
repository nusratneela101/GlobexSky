import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/rfqMatching.controller.js';

const router = Router();

// ─── Public Marketplace ──────────────────────────────────────────────────────
router.get('/marketplace', ctrl.getMarketplace);

// ─── Authenticated Routes ────────────────────────────────────────────────────
router.use(authenticate);

// Trigger matching for an RFQ
router.post('/match/:rfqId', [param('rfqId').isUUID()], validate, ctrl.triggerMatching);

// Get matches for an RFQ
router.get('/matches/:rfqId', [param('rfqId').isUUID()], validate, ctrl.getMatches);

// Supplier: get their matched RFQs
router.get('/supplier/matches', ctrl.supplierMatches);

// Mark match as viewed
router.put('/matches/:matchId/view', [param('matchId').isUUID()], validate, ctrl.markViewed);

// Publish RFQ to marketplace
router.post('/marketplace/:rfqId', [param('rfqId').isUUID()], validate, ctrl.publishMarketplace);

// ─── Admin Config ────────────────────────────────────────────────────────────
router.get('/config', ctrl.getConfig);
router.put('/config', ctrl.updateConfig);
router.post('/config/test', ctrl.testMatchingConfig);

export default router;
