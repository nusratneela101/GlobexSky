import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/dropshipping.controller.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', ctrl.getDashboard);
router.get('/products', ctrl.listDropshippingProducts);
router.post('/import', ctrl.importProduct);
router.get('/markups', ctrl.getMarkupSettings);
router.put('/markups', ctrl.updateMarkupSettings);
router.get('/inventory', ctrl.getInventorySync);
router.post('/sync', ctrl.syncInventory);

export default router;
