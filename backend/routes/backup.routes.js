import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/backup.controller.js';

const router = Router();

// All backup routes are admin-only
router.use(authenticate, requireAdmin);

router.post('/', [body('type').optional().isIn(['full', 'incremental'])], validate, ctrl.createBackup);
router.get('/', ctrl.listBackups);
router.post('/:id/restore', [param('id').notEmpty()], validate, ctrl.restoreBackup);
router.delete('/:id', [param('id').notEmpty()], validate, ctrl.deleteBackup);
router.get('/schedule', ctrl.getBackupSchedule);
router.patch('/schedule', ctrl.updateBackupSchedule);

export default router;
