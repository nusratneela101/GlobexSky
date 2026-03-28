/**
 * backend/controllers/customization.controller.js
 *
 * Controller for the OEM / Product Customization Request System API.
 */

import CustomizationRequest from '../models/CustomizationRequest.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

// ─── POST /api/v1/customization ───────────────────────────────────────────────

/** Create a new customization request (draft). */
export async function createRequest(req, res, next) {
  try {
    const {
      supplier_id, product_id, title, description, specifications,
      attachments, quantity, target_price, target_date,
    } = req.body;

    const request = await CustomizationRequest.createRequest({
      buyer_id: req.user.id,
      supplier_id: supplier_id || null,
      product_id: product_id || null,
      title,
      description,
      specifications: specifications || {},
      attachments: attachments || [],
      quantity: quantity || null,
      target_price: target_price || null,
      target_date: target_date || null,
    });

    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/customization/:id ───────────────────────────────────────────

/** Get a customization request with its quotes. */
export async function getRequest(req, res, next) {
  try {
    const request = await CustomizationRequest.findById(req.params.id);
    if (!request) return sendError(res, 404, 'Customization request not found.');

    const quotes = await CustomizationRequest.getQuotes(req.params.id);
    return res.json({ success: true, data: { ...request, quotes } });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/customization/:id ───────────────────────────────────────────

/** Update a draft customization request. */
export async function updateRequest(req, res, next) {
  try {
    const request = await CustomizationRequest.findById(req.params.id);
    if (!request) return sendError(res, 404, 'Customization request not found.');
    if (request.buyer_id !== req.user.id) return sendError(res, 403, 'Forbidden.');
    if (request.status !== 'draft') return sendError(res, 422, 'Only draft requests can be edited.');

    const allowed = ['title','description','specifications','attachments','quantity','target_price','target_date','supplier_id','product_id'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const updated = await CustomizationRequest.update(req.params.id, updates);
    return res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/customization/:id/submit ────────────────────────────────────

/** Submit a draft request to suppliers. */
export async function submitRequest(req, res, next) {
  try {
    const request = await CustomizationRequest.submitRequest(req.params.id, req.user.id);

    // Auto-notify matching suppliers if config is enabled
    const config = await CustomizationRequest.getConfig();
    const configMap = Object.fromEntries(config.map((c) => [c.key, c.value]));
    const featureEnabled = configMap.feature_enabled === 'true';
    const autoNotify = configMap.auto_notify_matching_suppliers === 'true';

    let notifiedSuppliers = [];
    if (featureEnabled && autoNotify) {
      notifiedSuppliers = await CustomizationRequest.matchSuppliers(req.params.id);
    }

    return res.json({ success: true, data: request, notified_suppliers: notifiedSuppliers.length });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/customization/buyer/my ──────────────────────────────────────

/** Get all requests made by the authenticated buyer. */
export async function getBuyerRequests(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const result = await CustomizationRequest.getByBuyer(req.user.id, {
      page: Number(page),
      limit: Number(limit),
      filters,
    });
    return res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/customization/supplier/my ───────────────────────────────────

/** Get all requests assigned to the authenticated supplier. */
export async function getSupplierRequests(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const result = await CustomizationRequest.getBySupplier(req.user.id, {
      page: Number(page),
      limit: Number(limit),
      filters,
    });
    return res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/customization/:id/quotes ───────────────────────────────────

/** Supplier submits a quote for a request. */
export async function submitQuote(req, res, next) {
  try {
    const { unit_price, total_price, moq, lead_time_days, notes, valid_until } = req.body;

    const quote = await CustomizationRequest.addQuote(req.params.id, {
      supplier_id: req.user.id,
      unit_price,
      total_price,
      moq: moq || null,
      lead_time_days: lead_time_days || null,
      notes: notes || null,
      valid_until: valid_until || null,
    });

    return res.status(201).json({ success: true, data: quote });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── PUT /api/v1/customization/:id/quotes/:quoteId/accept ────────────────────

/** Buyer accepts a supplier's quote. */
export async function acceptQuote(req, res, next) {
  try {
    const quote = await CustomizationRequest.acceptQuote(
      req.params.id,
      req.params.quoteId,
      req.user.id,
    );
    return res.json({ success: true, data: quote });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── PUT /api/v1/customization/:id/quotes/:quoteId/reject ────────────────────

/** Buyer rejects a supplier's quote. */
export async function rejectQuote(req, res, next) {
  try {
    const quote = await CustomizationRequest.rejectQuote(
      req.params.id,
      req.params.quoteId,
      req.user.id,
    );
    return res.json({ success: true, data: quote });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── POST /api/v1/customization/:id/messages ─────────────────────────────────

/** Send a message in a customization request thread. */
export async function sendMessage(req, res, next) {
  try {
    const { message, attachments } = req.body;
    const msg = await CustomizationRequest.sendMessage(req.params.id, {
      sender_id: req.user.id,
      message,
      attachments: attachments || [],
    });
    return res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/customization/:id/messages ──────────────────────────────────

/** Get messages in a customization request thread. */
export async function getMessages(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { data, total } = await CustomizationRequest.getMessages(
      req.params.id,
      Number(page),
      Number(limit),
    );
    return res.json({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/customization/config ────────────────────────────────────────

/** Admin: get OEM customization configuration. */
export async function getConfig(req, res, next) {
  try {
    const rows = await CustomizationRequest.getConfig();
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/customization/config ────────────────────────────────────────

/** Admin: update one or more config values. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return sendError(res, 400, 'Request body must be a key→value object.');
    }
    const actorId = req.user.id;
    const results = await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        CustomizationRequest.setConfig(key, String(value), actorId),
      ),
    );
    return res.json({ success: true, data: results });
  } catch (err) { next(err); }
}
