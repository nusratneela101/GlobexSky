/**
 * Globex Sky — systemLogs.routes.js
 * Admin-only routes for system logs, audit trail, health status, and export.
 * All routes require valid JWT + admin role.
 */

import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/systemLogs.controller.js';

const router = Router();

// Apply admin auth to all routes in this router
router.use(authenticate, requireAdmin);

// ─── Common query validators ──────────────────────────────────────────────────
const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];

const dateRangeValidators = [
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/logs/errors — error log with filters */
router.get(
  '/errors',
  [
    query('level').optional().isIn(['critical', 'error', 'warning', 'info', 'all']),
    query('search').optional().isString().trim(),
    ...dateRangeValidators,
    ...paginationValidators,
  ],
  validate,
  ctrl.getErrorLogs,
);

/** GET /api/v1/admin/logs/activity — user/admin/system activity */
router.get(
  '/activity',
  [
    query('user_id').optional().isString().trim(),
    query('action').optional().isString().trim(),
    query('search').optional().isString().trim(),
    ...dateRangeValidators,
    ...paginationValidators,
  ],
  validate,
  ctrl.getActivityLogs,
);

/** GET /api/v1/admin/logs/audit — data change audit trail */
router.get(
  '/audit',
  [
    query('entity').optional().isIn(['user', 'product', 'order', 'payment', 'supplier', 'setting', 'other']),
    query('admin_id').optional().isString().trim(),
    query('search').optional().isString().trim(),
    ...dateRangeValidators,
    ...paginationValidators,
  ],
  validate,
  ctrl.getAuditTrail,
);

/** GET /api/v1/admin/system/health — server, db, memory, cpu status */
router.get('/health', ctrl.getSystemHealth);

/** GET /api/v1/admin/system/performance — api response times, slow queries */
router.get('/performance', ctrl.getPerformanceMetrics);

/** GET /api/v1/admin/logs/export — export logs as CSV or JSON */
router.get(
  '/export',
  [
    query('type').optional().isIn(['errors', 'activity', 'audit']),
    query('format').optional().isIn(['json', 'csv']),
    ...dateRangeValidators,
  ],
  validate,
  ctrl.exportLogs,
);

export default router;
