import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';

const router = Router();

// ─── Consent Records ──────────────────────────────────────────────────────────
router.get('/consent', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user?.id || null,
      consentDate: null,
      consentVersion: '1.0',
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      },
    },
  });
});

router.post('/consent', authenticate, [
  body('analytics').isBoolean(),
  body('marketing').isBoolean(),
  body('functional').isBoolean(),
], validate, (req, res) => {
  const { analytics, marketing, functional } = req.body;
  res.json({
    success: true,
    message: 'Consent preferences saved.',
    data: {
      necessary: true,
      analytics,
      marketing,
      functional,
      consentDate: new Date().toISOString(),
      consentVersion: '1.0',
    },
  });
});

// ─── Consent Analytics (admin) ────────────────────────────────────────────────
router.get('/consent/analytics', authenticate, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: [
      { category: 'analytics', accepted: 7840, rejected: 2160 },
      { category: 'marketing', accepted: 5230, rejected: 4770 },
      { category: 'functional', accepted: 8920, rejected: 1080 },
    ],
  });
});

// ─── Data Export (Portability) ────────────────────────────────────────────────
router.post('/export', authenticate, [
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  body('categories').optional().isArray(),
], validate, (req, res) => {
  const { format } = req.body;
  // In production: enqueue background job, notify via email
  res.json({
    success: true,
    message: `Your data export (${format.toUpperCase()}) is being prepared. You will receive an email when ready.`,
    data: {
      exportId: 'EXP-' + Date.now(),
      format,
      requestedAt: new Date().toISOString(),
      estimatedReady: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

router.get('/exports', authenticate, (req, res) => {
  // Return export history for the authenticated user
  res.json({ success: true, data: [] });
});

router.get('/exports/:exportId/download', authenticate, [
  param('exportId').trim().notEmpty(),
], validate, (req, res) => {
  // In production: stream the export file securely
  res.status(404).json({ success: false, message: 'Export not found or expired.' });
});

// ─── Data Deletion Requests (Right to be Forgotten) ──────────────────────────
router.post('/deletion-request', authenticate, [
  body('reason').optional().trim().isLength({ max: 1000 }),
], validate, (req, res) => {
  const { reason } = req.body;
  res.status(201).json({
    success: true,
    message: 'Deletion request received. We will process it within 30 days.',
    data: {
      requestId: 'DEL-' + Date.now(),
      reason: reason || 'User requested account deletion',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      processBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

router.get('/deletion-request', authenticate, (req, res) => {
  res.json({ success: true, data: [] });
});

// ─── Admin: Deletion Request Queue ───────────────────────────────────────────
router.get('/admin/deletion-requests', authenticate, requireAdmin, [
  query('status').optional().isIn(['pending', 'processing', 'completed', 'rejected']),
  query('page').optional().isInt({ min: 1 }),
], validate, (req, res) => {
  res.json({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0 } });
});

router.patch('/admin/deletion-requests/:id', authenticate, requireAdmin, [
  param('id').trim().notEmpty(),
  body('status').isIn(['processing', 'completed', 'rejected']),
  body('adminNote').optional().trim().isLength({ max: 500 }),
], validate, (req, res) => {
  res.json({ success: true, message: 'Deletion request updated.' });
});

// ─── Data Breach Notification ─────────────────────────────────────────────────
router.post('/breach-notification', authenticate, requireAdmin, [
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }),
  body('severity').isIn(['low', 'medium', 'high', 'critical']),
  body('affectedUsers').optional().isInt({ min: 0 }),
], validate, (req, res) => {
  const { message, severity, affectedUsers } = req.body;
  res.json({
    success: true,
    message: 'Breach notification queued for delivery.',
    data: {
      notificationId: 'BN-' + Date.now(),
      message,
      severity,
      affectedUsers: affectedUsers || 0,
      issuedAt: new Date().toISOString(),
    },
  });
});

// ─── Age Verification ─────────────────────────────────────────────────────────
router.post('/verify-age', authenticate, [
  body('dob').isISO8601().withMessage('Date of birth must be a valid date'),
], validate, (req, res) => {
  const dob = new Date(req.body.dob);
  const ageDiff = Date.now() - dob.getTime();
  const age = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) {
    return res.status(403).json({ success: false, message: 'You must be 18 or older.' });
  }
  res.json({ success: true, verified: true, age });
});

export default router;
