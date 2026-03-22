/**
 * Admin Roles Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/adminRoleController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Roles
router.get('/', ctrl.listRoles);
router.post('/', [body('name').notEmpty()], validate, ctrl.createRole);
router.put('/:id', [param('id').isUUID()], validate, ctrl.updateRole);
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteRole);

// Admin Users (role assignments)
router.get('/admin-users', ctrl.listAdminUsers);
router.post('/admin-users', [body('user_id').isUUID(), body('role_id').isUUID()], validate, ctrl.assignAdminRole);

// Activity logs
router.get('/activity-logs', ctrl.listActivityLogs);

export default router;
