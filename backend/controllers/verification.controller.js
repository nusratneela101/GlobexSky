/**
 * Verification Controller — handles KYC document upload, face verification,
 * liveness detection, status retrieval, and admin review.
 */

import { v4 as uuidv4 } from 'uuid';
import supabase from '../config/supabase.js';
import {
  compareFaces,
  checkLiveness as checkLivenessService,
  extractDocumentData,
  validateDocument,
  sendVerificationNotification,
} from '../services/verification.service.js';

// ─── POST /api/v1/verification/document ──────────────────────────────────────
/**
 * Upload identity document (front + optional back) and trigger OCR extraction.
 * Expects multipart/form-data with fields: documentType, documentNumber,
 * expiryDate, country — and file fields: frontImage, backImage (optional).
 */
export async function uploadDocument(req, res, next) {
  try {
    const userId = req.user.id;
    const { documentType, documentNumber, expiryDate, country } = req.body;

    // Validate required fields
    const missing = [];
    if (!documentType) missing.push('documentType');
    if (!documentNumber) missing.push('documentNumber');
    if (!expiryDate) missing.push('expiryDate');
    if (!country) missing.push('country');
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        data: null,
      });
    }

    const allowedTypes = ['nid', 'passport', 'drivers_license'];
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid documentType. Allowed: ${allowedTypes.join(', ')}`,
        data: null,
      });
    }

    // Check expiry — documents expiring today are still valid
    if (new Date(expiryDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)) {
      return res.status(400).json({
        success: false,
        message: 'Document has expired. Please provide a valid document.',
        data: null,
      });
    }

    // File URLs from multer/cloudinary (upload middleware attaches these)
    const frontImage = req.files?.frontImage?.[0];
    const backImage  = req.files?.backImage?.[0];

    if (!frontImage) {
      return res.status(400).json({
        success: false,
        message: 'Front image of the document is required.',
        data: null,
      });
    }

    // Run OCR extraction (mock)
    const extractedData = await extractDocumentData(frontImage.buffer || Buffer.alloc(0), documentType);

    // Validate document
    const validation = await validateDocument({
      ...extractedData,
      documentNumber,
      expiryDate,
    });

    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        message: 'Document validation failed.',
        data: { errors: validation.errors },
      });
    }

    const verificationId = uuidv4();

    // Persist in Supabase (table: kyc_verifications)
    // Each submission creates a new record to preserve history.
    const { error: dbError } = await supabase.from('kyc_verifications').insert({
      id: verificationId,
      user_id: userId,
      document_type: documentType,
      document_number: documentNumber,
      expiry_date: expiryDate,
      country,
      front_image_url: frontImage.path,
      back_image_url: backImage?.path || null,
      extracted_data: extractedData,
      status: 'document_uploaded',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('[VerificationController] DB error (uploadDocument):', dbError.message);
      // Non-fatal — continue with in-memory flow
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully. Proceed to face verification.',
      data: {
        verificationId,
        status: 'document_uploaded',
        extractedData,
        nextStep: 'face_verification',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/verification/face ──────────────────────────────────────────
/**
 * Accept a selfie image and compare it against the previously uploaded document.
 * Expects multipart/form-data with file field: selfie.
 */
export async function verifyFace(req, res, next) {
  try {
    const userId = req.user.id;
    const selfie = req.file;

    if (!selfie) {
      return res.status(400).json({
        success: false,
        message: 'Selfie image is required.',
        data: null,
      });
    }

    // Fetch existing verification record
    const { data: record } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Run face comparison (mock — real integration via AWS Rekognition / Azure)
    const faceResult = await compareFaces(
      selfie.buffer || Buffer.alloc(0),
      Buffer.alloc(0), // document photo buffer (would be fetched from storage in production)
    );

    const selfieUrl = selfie.path; // Set by cloudinary multer storage
    const overallStatus = faceResult.matched ? 'pending_review' : 'face_mismatch';

    // Update verification record
    await supabase
      .from('kyc_verifications')
      .update({
        selfie_url: selfieUrl,
        face_match_score: faceResult.confidence,
        face_matched: faceResult.matched,
        status: overallStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (faceResult.matched) {
      await sendVerificationNotification(userId, 'pending');
    }

    res.json({
      success: true,
      message: faceResult.matched
        ? 'Face verification passed. Your submission is under review.'
        : 'Face did not match the document photo. Please try again.',
      data: {
        matched: faceResult.matched,
        confidence: faceResult.confidence,
        status: overallStatus,
        verificationId: record?.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/verification/liveness ──────────────────────────────────────
/**
 * Perform liveness detection on submitted frames (base64 encoded JSON array).
 * Body: { frames: ["base64...", "base64...", ...] }
 */
export async function checkLiveness(req, res, next) {
  try {
    const { frames } = req.body;

    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'frames array is required and must not be empty.',
        data: null,
      });
    }

    if (frames.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 30 frames allowed per liveness check.',
        data: null,
      });
    }

    // Convert base64 frames to buffers
    const frameBuffers = frames.map(b64 => Buffer.from(b64, 'base64'));

    const livenessResult = await checkLivenessService(frameBuffers);

    // Persist liveness result against user's verification
    await supabase
      .from('kyc_verifications')
      .update({
        liveness_score: livenessResult.confidence,
        liveness_passed: livenessResult.live,
        liveness_session_id: livenessResult.sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id);

    res.json({
      success: true,
      message: livenessResult.live
        ? 'Liveness check passed.'
        : 'Liveness check failed. Please retry.',
      data: livenessResult,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/verification/status/:userId ─────────────────────────────────
/**
 * Return the current KYC verification status for a user.
 * Regular users may only fetch their own status; admins can fetch anyone's.
 */
export async function getVerificationStatus(req, res, next) {
  try {
    const requestingUser = req.user;
    const { userId } = req.params;

    // Authorization: self or admin
    const isAdmin = requestingUser?.profile?.role === 'admin';
    if (!isAdmin && requestingUser.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
        data: null,
      });
    }

    const { data: record, error } = await supabase
      .from('kyc_verifications')
      .select('id, status, document_type, face_match_score, liveness_score, created_at, updated_at, admin_notes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return res.json({
        success: true,
        message: 'No verification record found.',
        data: { status: 'unverified' },
      });
    }

    res.json({
      success: true,
      message: 'Verification status retrieved.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/v1/verification/admin/review/:verificationId ───────────────────
/**
 * Admin approves, rejects, or requests resubmission for a KYC record.
 * Body: { decision: 'approved'|'rejected'|'resubmit', notes: string }
 */
export async function adminReview(req, res, next) {
  try {
    const { verificationId } = req.params;
    const { decision, notes } = req.body;

    const allowedDecisions = ['approved', 'rejected', 'resubmit'];
    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: `Invalid decision. Allowed: ${allowedDecisions.join(', ')}`,
        data: null,
      });
    }

    const statusMap = {
      approved: 'verified',
      rejected: 'rejected',
      resubmit: 'resubmit_required',
    };

    const { data: record, error } = await supabase
      .from('kyc_verifications')
      .update({
        status: statusMap[decision],
        admin_notes: notes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', verificationId)
      .select('user_id, status')
      .single();

    if (error || !record) {
      return res.status(404).json({
        success: false,
        message: 'Verification record not found.',
        data: null,
      });
    }

    // Also update the user profile's kyc_status
    await supabase
      .from('profiles')
      .update({ kyc_status: statusMap[decision] })
      .eq('user_id', record.user_id);

    await sendVerificationNotification(record.user_id, decision, { reason: notes });

    res.json({
      success: true,
      message: `Verification ${decision} successfully.`,
      data: { verificationId, decision, status: statusMap[decision] },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/verification/admin/pending ──────────────────────────────────
/**
 * List all pending KYC submissions for admin review.
 * Query params: page (default 1), limit (default 20)
 */
export async function listPendingVerifications(req, res, next) {
  try {
    const page  = parseInt(req.query.page, 10)  || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { data: records, error, count } = await supabase
      .from('kyc_verifications')
      .select(`
        id, user_id, document_type, document_number, country,
        front_image_url, back_image_url, selfie_url,
        face_match_score, liveness_score, status,
        created_at, updated_at,
        profiles!kyc_verifications_user_id_fkey(full_name, email)
      `, { count: 'exact' })
      .in('status', ['pending_review', 'document_uploaded'])
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[VerificationController] DB error (listPending):', error.message);
      return res.status(500).json({ success: false, message: 'Failed to fetch records.', data: null });
    }

    res.json({
      success: true,
      message: 'Pending verifications retrieved.',
      data: {
        records: records || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
