/**
 * Globex Sky — integration.routes.js
 * Admin endpoints for managing external service integrations.
 *
 * All routes require authentication and admin role.
 *
 * POST /api/v1/integrations/alibaba/sync          — Trigger Alibaba product sync
 * GET  /api/v1/integrations/alibaba/search        — Search Alibaba products
 * POST /api/v1/integrations/alibaba/import        — Import a specific Alibaba product
 * GET  /api/v1/integrations/alibaba/supplier/:id  — Get Alibaba supplier info
 * GET  /api/v1/integrations/alibaba/compare       — Compare prices for a keyword
 *
 * POST /api/v1/integrations/1688/sync             — Trigger 1688 product sync
 * GET  /api/v1/integrations/1688/search           — Search 1688 products
 * POST /api/v1/integrations/1688/import           — Import a specific 1688 product
 *
 * POST /api/v1/integrations/aliexpress/sync       — Trigger AliExpress price monitor
 * GET  /api/v1/integrations/aliexpress/search     — Search AliExpress products
 * POST /api/v1/integrations/aliexpress/import     — Import a specific AliExpress product
 * POST /api/v1/integrations/aliexpress/order      — Place a dropshipping order
 * GET  /api/v1/integrations/aliexpress/track/:id  — Track an AliExpress order
 *
 * GET  /api/v1/integrations/sync-status           — Get sync history/status
 * POST /api/v1/integrations/sync-settings         — Update sync settings
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/integration.controller.js';

const router = Router();

// All integration routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── Alibaba ──────────────────────────────────────────────────────────────────
router.post('/alibaba/sync', ctrl.syncAlibaba);
router.get('/alibaba/search', [query('keyword').notEmpty().trim()], validate, ctrl.searchAlibabaProducts);
router.post('/alibaba/import', [body('productId').notEmpty().trim()], validate, ctrl.importAlibabaProduct);
router.get('/alibaba/supplier/:companyId', [param('companyId').notEmpty()], validate, ctrl.getAlibabaSupplier);
router.get('/alibaba/compare', [query('keyword').notEmpty().trim()], validate, ctrl.compareAlibabaPrices);

// ─── 1688 ─────────────────────────────────────────────────────────────────────
router.post('/1688/sync', ctrl.sync1688);
router.get('/1688/search', [query('keyword').notEmpty().trim()], validate, ctrl.search1688Products);
router.post('/1688/import', [body('productId').notEmpty().trim()], validate, ctrl.import1688Product);

// ─── AliExpress ───────────────────────────────────────────────────────────────
router.post('/aliexpress/sync', ctrl.syncAliexpress);
router.get('/aliexpress/search', [query('keyword').notEmpty().trim()], validate, ctrl.searchAliexpressProducts);
router.post('/aliexpress/import', [body('productId').notEmpty().trim()], validate, ctrl.importAliexpressProduct);
router.post('/aliexpress/order', [
  body('productId').notEmpty(),
  body('skuId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('shippingAddress').isObject(),
  body('logisticsService').notEmpty(),
], validate, ctrl.placeAliexpressOrder);
router.get('/aliexpress/track/:orderId', [param('orderId').notEmpty()], validate, ctrl.trackAliexpressOrder);

// ─── Sync Status & Settings ───────────────────────────────────────────────────
router.get('/sync-status', ctrl.getSyncStatus);
router.post('/sync-settings', [
  body('source').isIn(['alibaba', '1688', 'aliexpress']),
  body('enabled').isBoolean(),
  body('intervalMinutes').optional().isInt({ min: 5 }),
], validate, ctrl.updateSyncSettings);

export default router;
