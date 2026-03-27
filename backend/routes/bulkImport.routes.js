import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import ImportExportJob from '../models/ImportExportJob.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/bulk-import/jobs
 * List import/export jobs for the current user (admin sees all).
 */
router.get('/jobs', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await ImportExportJob.findByUser(req.user.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/bulk-import/jobs/:id
 * Get details of a single job.
 */
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await ImportExportJob.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/bulk-import/import
 * Create an import job record.
 */
router.post(
  '/import',
  [
    body('entity_type').isIn(['products', 'orders', 'suppliers', 'users']).withMessage('Invalid entity type'),
    body('file_url').isURL().withMessage('Valid file_url is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { entity_type, file_url } = req.body;
      const job = await ImportExportJob.create({
        type: 'import',
        entity_type,
        file_url,
        status: 'pending',
        created_by: req.user.id,
      });
      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/bulk-import/export
 * Create an export job record.
 */
router.post(
  '/export',
  [
    body('entity_type').isIn(['products', 'orders', 'suppliers', 'users']).withMessage('Invalid entity type'),
    body('filters').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { entity_type, filters } = req.body;
      const job = await ImportExportJob.create({
        type: 'export',
        entity_type,
        status: 'pending',
        created_by: req.user.id,
        metadata: { filters: filters || {} },
      });
      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/bulk-import/jobs/:id/status  (admin)
 * Update job status.
 */
router.patch(
  '/jobs/:id/status',
  requireAdmin,
  [body('status').isIn(['pending', 'processing', 'completed', 'failed']).withMessage('Invalid status')],
  validate,
  async (req, res, next) => {
    try {
      const job = await ImportExportJob.updateStatus(req.params.id, req.body.status, req.body.extra || {});
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
