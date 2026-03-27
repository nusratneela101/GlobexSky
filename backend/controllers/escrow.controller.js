/**
 * backend/controllers/escrow.controller.js
 *
 * Controller for the Escrow Payment System API.
 * Every fund-movement action is audit-logged via the Escrow model.
 */

import Escrow from '../models/Escrow.js';
import * as escrowService from '../services/escrow.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

// ─── POST /api/v1/escrow ─────────────────────────────────────────────────────

/** Create an escrow transaction and hold funds. */
export async function createEscrow(req, res, next) {
  try {
    const { order_id, buyer_id, supplier_id, amount, currency = 'USD' } = req.body;
    const actorId = req.user.id;

    const escrow = await escrowService.createAndHold(
      { order_id, buyer_id, supplier_id, amount, currency },
      actorId,
    );

    return res.status(201).json({ success: true, data: escrow });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/escrow/:id ───────────────────────────────────────────────────

/** Get escrow details including milestones. */
export async function getEscrow(req, res, next) {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return sendError(res, 404, 'Escrow not found.');

    const milestones = await Escrow.getMilestones(req.params.id);
    return res.json({ success: true, data: { ...escrow, milestones } });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/escrow/:id/release ─────────────────────────────────────────

/** Release held funds to the supplier. Admin or confirmed buyer only. */
export async function releaseEscrow(req, res, next) {
  try {
    const actorId = req.user.id;
    const escrow = await escrowService.releaseFunds(req.params.id, actorId);
    return res.json({ success: true, data: escrow });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── POST /api/v1/escrow/:id/refund ──────────────────────────────────────────

/** Refund held funds back to the buyer. */
export async function refundEscrow(req, res, next) {
  try {
    const actorId = req.user.id;
    const { reason } = req.body;
    const escrow = await escrowService.refundFunds(req.params.id, actorId, reason);
    return res.json({ success: true, data: escrow });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── POST /api/v1/escrow/:id/milestones ──────────────────────────────────────

/** Add a milestone to an escrow transaction. */
export async function addMilestone(req, res, next) {
  try {
    const { name, amount, due_date } = req.body;
    const actorId = req.user.id;
    const milestone = await escrowService.addMilestone(req.params.id, { name, amount, due_date }, actorId);
    return res.status(201).json({ success: true, data: milestone });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── PUT /api/v1/escrow/:id/milestones/:milestoneId/complete ─────────────────

/** Mark a milestone as complete. Auto-releases escrow if all milestones are done. */
export async function completeMilestone(req, res, next) {
  try {
    const { id: escrowId, milestoneId } = req.params;
    const actorId = req.user.id;
    const result = await escrowService.completeMilestone(escrowId, milestoneId, actorId);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/escrow/:id/audit ────────────────────────────────────────────

/** Get paginated audit log for an escrow transaction. */
export async function getAuditLog(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data, total } = await Escrow.getAuditLog(req.params.id, Number(page), Number(limit));
    return res.json({
      success: true,
      data,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/escrow/config ────────────────────────────────────────────────

/** Get admin-level escrow configuration. Encrypted values are masked. */
export async function getConfig(req, res, next) {
  try {
    const rows = await Escrow.getConfig();
    // Mask encrypted values — never expose raw secrets via API
    const safe = rows.map((r) => ({
      ...r,
      value: r.is_encrypted ? (r.value ? '••••••••' : '') : r.value,
    }));
    return res.json({ success: true, data: safe });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/escrow/config ────────────────────────────────────────────────

/** Update one or more escrow config values. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body; // { key: value, … }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return sendError(res, 400, 'Request body must be a key→value object.');
    }
    const actorId = req.user.id;
    const results = await escrowService.saveEscrowConfig(updates, actorId);
    return res.json({ success: true, data: results });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/escrow/config/test-connection ───────────────────────────────

/** Test the configured payment gateway connection. */
export async function testGatewayConnection(req, res, next) {
  try {
    const result = await escrowService.testGatewayConnection();
    return res.json({ success: result.success, message: result.message });
  } catch (err) { next(err); }
}
