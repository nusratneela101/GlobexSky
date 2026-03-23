import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';

const router = Router();

// ─── PCI Compliance Status ────────────────────────────────────────────────────
router.get('/pci/status', authenticate, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      level: 'PCI DSS Level 1',
      lastAssessment: '2025-04-15',
      nextAssessment: '2026-04-15',
      overallStatus: 'compliant',
      checks: [
        { id: 'firewall', label: 'Firewall Configuration', status: 'pass' },
        { id: 'default-pass', label: 'Default Passwords', status: 'pass' },
        { id: 'card-data', label: 'Cardholder Data Protection', status: 'pass' },
        { id: 'transmission', label: 'Encrypted Transmission', status: 'pass' },
        { id: 'anti-malware', label: 'Anti-Malware', status: 'warning' },
        { id: 'secure-systems', label: 'Secure System Development', status: 'pass' },
        { id: 'access-control', label: 'Access Control', status: 'pass' },
        { id: 'unique-ids', label: 'Unique IDs per User', status: 'pass' },
        { id: 'physical', label: 'Physical Access Controls', status: 'pass' },
        { id: 'logging', label: 'Logging & Monitoring', status: 'pass' },
        { id: 'pen-test', label: 'Penetration Testing', status: 'warning' },
        { id: 'isms', label: 'Information Security Policy', status: 'pass' },
      ],
    },
  });
});

// ─── Security Scan Scheduling ─────────────────────────────────────────────────
router.get('/scans', authenticate, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, type: 'Vulnerability Scan', scheduled: '2025-07-01T02:00:00Z', status: 'scheduled' },
      { id: 2, type: 'Penetration Test', scheduled: '2025-07-15T00:00:00Z', status: 'scheduled' },
      { id: 3, type: 'PCI ASV Scan', scheduled: '2025-06-28T03:00:00Z', status: 'completed' },
    ],
  });
});

router.post('/scans', authenticate, requireAdmin, [
  body('type').trim().notEmpty().withMessage('Scan type is required'),
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO 8601 date'),
], validate, (req, res) => {
  const { type, scheduledAt } = req.body;
  res.status(201).json({
    success: true,
    message: 'Scan scheduled successfully.',
    data: { id: Date.now(), type, scheduledAt, status: 'scheduled' },
  });
});

router.delete('/scans/:id', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, message: `Scan ${req.params.id} cancelled.` });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
router.get('/audit-logs', authenticate, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('action').optional().trim(),
  query('start').optional().isISO8601(),
  query('end').optional().isISO8601(),
], validate, (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '50', 10);
  // Placeholder data — replace with real DB query
  res.json({
    success: true,
    data: [],
    pagination: { page, limit, total: 0 },
  });
});

// ─── Card Token Management ────────────────────────────────────────────────────
router.get('/tokens', authenticate, (req, res) => {
  // Returns masked card tokens for the authenticated user
  res.json({ success: true, data: [] });
});

router.delete('/tokens/:tokenId', authenticate, [
], validate, (req, res) => {
  res.json({ success: true, message: 'Token removed.' });
});

// ─── Security Headers Check ───────────────────────────────────────────────────
router.get('/headers-check', authenticate, requireAdmin, (req, res) => {
  const headers = req.headers;
  res.json({
    success: true,
    data: {
      contentSecurityPolicy: !!headers['content-security-policy'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentTypeOptions: !!headers['x-content-type-options'],
      strictTransportSecurity: !!headers['strict-transport-security'],
      referrerPolicy: !!headers['referrer-policy'],
    },
  });
});

export default router;
