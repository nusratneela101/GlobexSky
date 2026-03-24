/**
 * Admin Permissions & Roles Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/permissionController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/roles
router.get('/roles', ctrl.getRoles);

// POST /api/admin/roles
router.post('/roles', [body('name').notEmpty()], validate, ctrl.createRole);

// PUT /api/admin/roles/:id
router.put('/roles/:id', [param('id').isUUID()], validate, ctrl.updateRole);

// DELETE /api/admin/roles/:id
router.delete('/roles/:id', [param('id').isUUID()], validate, ctrl.deleteRole);

// GET /api/admin/permissions
router.get('/permissions', ctrl.getPermissions);

// POST /api/admin/users/:id/roles
router.post(
  '/users/:id/roles',
  [param('id').isUUID(), body('roleId').isUUID()],
  validate,
  ctrl.assignRole,
);

// DELETE /api/admin/users/:id/roles/:roleId
router.delete(
  '/users/:id/roles/:roleId',
  [param('id').isUUID(), param('roleId').isUUID()],
  validate,
  ctrl.removeRole,
);

// GET /api/admin/audit-log
router.get('/audit-log', ctrl.getAuditLog);

// GET /api/admin/permission-matrix
router.get('/permission-matrix', ctrl.getPermissionMatrix);

export default router;
