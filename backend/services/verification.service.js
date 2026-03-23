/**
 * Verification Service — KYC face & document verification logic.
 *
 * Mock implementations are provided. Replace the marked sections with real
 * API calls to production services such as:
 *  - AWS Rekognition  (face comparison, liveness detection)
 *  - Azure Face API   (face verification, ID reading)
 *  - Jumio / Onfido   (full KYC SDK)
 *  - Google Cloud Vision (OCR / document data extraction)
 */

import { v4 as uuidv4 } from 'uuid';

// ─── Face Comparison ──────────────────────────────────────────────────────────

/**
 * Compare a selfie against the photo extracted from an identity document.
 * Returns a confidence score between 0 and 100.
 *
 * @param {Buffer} selfieBuffer           - Raw image buffer of the captured selfie
 * @param {Buffer} documentPhotoBuffer    - Raw image buffer of the document photo
 * @returns {Promise<{matched: boolean, confidence: number, details: object}>}
 *
 * TODO: Replace mock with a real call, e.g.:
 *   const client = new RekognitionClient({...});
 *   const cmd = new CompareFacesCommand({ SourceImage: ..., TargetImage: ... });
 *   const result = await client.send(cmd);
 */
export async function compareFaces(selfieBuffer, documentPhotoBuffer) {
  // Validate inputs
  if (!selfieBuffer || !documentPhotoBuffer) {
    throw new Error('Both selfie and document photo buffers are required.');
  }

  // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────
  // Simulate processing delay (100–400 ms)
  await _simulateDelay(100, 400);

  // Generate a realistic confidence score (85–99 % for a "match")
  const confidence = Math.floor(Math.random() * 15) + 85; // 85–99
  const matched = confidence >= 80;

  return {
    matched,
    confidence,
    details: {
      similarity: confidence,
      faceDetectedInSelfie: true,
      faceDetectedInDocument: true,
      qualityScore: Math.floor(Math.random() * 20) + 80, // 80–99
      pose: { roll: 0.5, yaw: 1.2, pitch: -0.8 },
    },
  };
  // ── END MOCK ─────────────────────────────────────────────────────────────
}

// ─── Liveness Detection ───────────────────────────────────────────────────────

/**
 * Perform liveness detection on an array of captured video frames.
 * Returns a liveness confidence score and whether the check passed.
 *
 * @param {Buffer[]} frames   - Array of raw image buffers (key video frames)
 * @returns {Promise<{live: boolean, confidence: number, challengesPassed: string[]}>}
 *
 * TODO: Replace mock with AWS Rekognition StartFaceLivenessSession,
 *       Azure Face Liveness Detection, or Onfido Motion Capture API.
 */
export async function checkLiveness(frames) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('At least one frame is required for liveness detection.');
  }

  // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────
  await _simulateDelay(200, 500);

  const confidence = Math.floor(Math.random() * 10) + 90; // 90–99
  const challengesPassed = ['head_turn_left', 'head_turn_right', 'blink'];

  return {
    live: true,
    confidence,
    challengesPassed,
    frameCount: frames.length,
    sessionId: uuidv4(),
  };
  // ── END MOCK ─────────────────────────────────────────────────────────────
}

// ─── Document OCR ─────────────────────────────────────────────────────────────

/**
 * Extract structured data from a scanned identity document image.
 *
 * @param {Buffer} documentBuffer  - Raw image buffer of the document
 * @param {'nid'|'passport'|'drivers_license'} docType
 * @returns {Promise<{fullName: string, dateOfBirth: string, documentNumber: string,
 *                    expiryDate: string, nationality: string, gender: string}>}
 *
 * TODO: Replace mock with:
 *   - Google Cloud Vision documentTextDetection
 *   - AWS Textract AnalyzeID
 *   - Mindee API
 */
export async function extractDocumentData(documentBuffer, docType) {
  if (!documentBuffer) {
    throw new Error('Document buffer is required.');
  }

  // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────
  await _simulateDelay(300, 800);

  const mockData = {
    nid: {
      fullName: 'JOHN DOE',
      dateOfBirth: '1990-05-15',
      documentNumber: 'NID' + Math.floor(Math.random() * 9000000 + 1000000),
      expiryDate: '2030-05-14',
      nationality: 'BD',
      gender: 'M',
      issuingAuthority: 'Bangladesh Election Commission',
    },
    passport: {
      fullName: 'JOHN DOE',
      dateOfBirth: '1990-05-15',
      documentNumber: 'A' + Math.floor(Math.random() * 9000000 + 1000000),
      expiryDate: '2032-05-14',
      nationality: 'BD',
      gender: 'M',
      issuingAuthority: 'Department of Immigration',
    },
    drivers_license: {
      fullName: 'JOHN DOE',
      dateOfBirth: '1990-05-15',
      documentNumber: 'DL' + Math.floor(Math.random() * 9000000 + 1000000),
      expiryDate: '2028-05-14',
      nationality: 'BD',
      gender: 'M',
      issuingAuthority: 'BRTA',
    },
  };

  return mockData[docType] || mockData.nid;
  // ── END MOCK ─────────────────────────────────────────────────────────────
}

// ─── Document Validation ──────────────────────────────────────────────────────

/**
 * Validate a document: check expiry date, supported country, format integrity.
 *
 * @param {object} documentData   - Parsed document data (from extractDocumentData or user input)
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateDocument(documentData) {
  const errors = [];

  if (!documentData) {
    return { valid: false, errors: ['No document data provided.'] };
  }

  // Check expiry
  if (documentData.expiryDate) {
    const expiry = new Date(documentData.expiryDate);
    if (expiry < new Date()) {
      errors.push('Document has expired.');
    }
  } else {
    errors.push('Expiry date is required.');
  }

  // Check document number format
  if (!documentData.documentNumber || documentData.documentNumber.trim().length < 5) {
    errors.push('Invalid or missing document number.');
  }

  // Check full name
  if (!documentData.fullName || documentData.fullName.trim().length < 2) {
    errors.push('Full name is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────

/**
 * Notify the user of their KYC verification result via email/SMS.
 *
 * @param {string} userId
 * @param {'approved'|'rejected'|'pending'|'resubmit'} status
 * @param {object} [meta]  - Extra context (reason for rejection, etc.)
 * @returns {Promise<void>}
 *
 * TODO: Replace mock with nodemailer / Twilio / SendGrid calls.
 *       Import sendEmail from '../services/email.service.js'.
 */
export async function sendVerificationNotification(userId, status, meta = {}) {
  // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────
  const messages = {
    approved: 'Your identity has been verified successfully.',
    rejected: `Your identity verification was rejected. Reason: ${meta.reason || 'N/A'}`,
    pending:  'Your identity verification is under review.',
    resubmit: 'Please resubmit your identity documents.',
  };

  // In production: await sendEmail(userId, 'KYC Update', messages[status]);
  console.log(`[VerificationService] Notification → userId=${userId} status=${status} msg="${messages[status]}"`);
  // ── END MOCK ─────────────────────────────────────────────────────────────
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _simulateDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
