import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupplier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/warehouse.controller.js';

const router = Router();

router.use(authenticate);

/* ──────────────────────────────────────────────
   WAREHOUSE CRUD  (admin only)
   ────────────────────────────────────────────── */
router.post(
  '/',
  requireAdmin,
  [
    body('name').trim().notEmpty(),
    body('location').trim().notEmpty(),
    body('country').trim().notEmpty(),
    body('capacity').isInt({ min: 1 }),
  ],
  validate,
  ctrl.createWarehouse,
);

router.get(
  '/',
  requireSupplier,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 })],
  validate,
  ctrl.getWarehouses,
);

router.get(
  '/:id',
  requireSupplier,
  [param('id').isUUID()],
  validate,
  ctrl.getWarehouseById,
);

router.put(
  '/:id',
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.updateWarehouse,
);

router.delete(
  '/:id',
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.deleteWarehouse,
);

/* ──────────────────────────────────────────────
   INVENTORY ENDPOINTS
   ────────────────────────────────────────────── */
router.get(
  '/:id/inventory',
  requireSupplier,
  [param('id').isUUID()],
  validate,
  ctrl.getWarehouseInventory,
);

router.post(
  '/:id/inventory',
  requireAdmin,
  [
    param('id').isUUID(),
    body('product_id').isUUID(),
    body('quantity').isInt({ min: 0 }),
  ],
  validate,
  ctrl.addInventoryItem,
);

router.put(
  '/:id/inventory/:itemId',
  requireAdmin,
  [param('id').isUUID(), param('itemId').isUUID()],
  validate,
  ctrl.updateInventoryItem,
);

/* ──────────────────────────────────────────────
   TRANSFER
   ────────────────────────────────────────────── */
router.post(
  '/transfer',
  requireAdmin,
  [
    body('source_warehouse_id').isUUID(),
    body('destination_warehouse_id').isUUID(),
    body('product_id').isUUID(),
    body('quantity').isInt({ min: 1 }),
  ],
  validate,
  ctrl.transferInventory,
);

export default router;
