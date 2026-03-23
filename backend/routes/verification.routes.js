/**
 * Verification Routes — KYC document & face verification endpoints.
 * Base path: /api/v1/verification  (registered in server.js)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { uploadDocument as uploadDocumentMiddleware } from '../middleware/upload.js';
import {
  uploadDocument,
  verifyFace,
  checkLiveness,
  getVerificationStatus,
  adminReview,
  listPendingVerifications,
} from '../controllers/verification.controller.js';

const router = Router();

// ── Public-ish (authenticated users only) ────────────────────────────────────

/**
 * POST /api/v1/verification/document
 * Upload identity document images + metadata.
 * Files: frontImage (required), backImage (optional)
 */
router.post(
  '/document',
  authenticate,
  uploadDocumentMiddleware.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage',  maxCount: 1 },
  ]),
  uploadDocument,
);

/**
 * POST /api/v1/verification/face
 * Submit a selfie for face comparison against the uploaded document.
 * File: selfie (required)
 */
router.post(
  '/face',
  authenticate,
  uploadDocumentMiddleware.single('selfie'),
  verifyFace,
);

/**
 * POST /api/v1/verification/liveness
 * Submit captured video frames for liveness detection.
 * Body: { frames: string[] }  — base64-encoded images
 */
router.post('/liveness', authenticate, checkLiveness);

/**
 * GET /api/v1/verification/status/:userId
 * Retrieve verification status. Users can only access their own; admins any.
 */
router.get('/status/:userId', authenticate, getVerificationStatus);

// ── Admin only ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/verification/admin/pending
 * List all KYC submissions pending admin review.
 */
router.get('/admin/pending', authenticate, requireAdmin, listPendingVerifications);

/**
 * PUT /api/v1/verification/admin/review/:verificationId
 * Approve, reject, or request resubmission for a KYC record.
 * Body: { decision: 'approved'|'rejected'|'resubmit', notes?: string }
 */
router.put('/admin/review/:verificationId', authenticate, requireAdmin, adminReview);

export default router;
