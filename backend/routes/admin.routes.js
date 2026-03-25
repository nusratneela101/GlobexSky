import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/admin.controller.js';
import { getMode, setMode } from '../config/envManager.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', ctrl.getDashboardStats);
router.get('/users', ctrl.listUsers);
router.get('/users/:id', [param('id').isUUID()], validate, ctrl.getUser);
router.patch('/users/:id', [param('id').isUUID()], validate, ctrl.updateUser);
router.delete('/users/:id', [param('id').isUUID()], validate, ctrl.deleteUser);

router.get('/orders', ctrl.listAllOrders);
router.get('/products', ctrl.listAllProducts);
router.patch('/products/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateProductStatus,
);

router.get('/transactions', ctrl.listAllTransactions);
router.get('/suppliers', ctrl.listSuppliers);
router.patch('/suppliers/:id/verify', [param('id').isUUID()], validate, ctrl.verifySupplier);

router.get('/site-settings', ctrl.getSiteSettings);
router.put('/site-settings', ctrl.updateSiteSettings);
router.get('/feature-toggles', ctrl.getFeatureToggles);
router.put('/feature-toggles', ctrl.updateFeatureToggle);

// ─── App Mode (Test / Live) ───────────────────────────────────────────────────

/**
 * GET /api/v1/admin/app-mode
 * Returns the current APP_MODE (test or live).
 */
router.get('/app-mode', (_req, res) => {
  res.json({ success: true, data: { mode: getMode() } });
});

/**
 * POST /api/v1/admin/app-mode
 * Body: { mode: "test" | "live" }
 * Switches the runtime APP_MODE without restarting the server.
 */
router.post('/app-mode',
  [body('mode').isIn(['test', 'live']).withMessage('mode must be "test" or "live"')],
  validate,
  (req, res) => {
    try {
      setMode(req.body.mode);
      res.json({ success: true, data: { mode: getMode() } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
);

export default router;
