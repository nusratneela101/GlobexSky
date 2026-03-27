import SampleOrder, { SampleOrderConfig } from '../models/SampleOrder.js';
import { buildPagination } from '../utils/pagination.js';

// ─── Config helpers ─────────────────────────────────────────────────────────

async function getConfig() {
  try {
    return await SampleOrderConfig.getAll();
  } catch {
    return {};
  }
}

async function isFeatureEnabled() {
  const cfg = await getConfig();
  return cfg.feature_enabled === 'true';
}

// ─── Buyer: request a sample ────────────────────────────────────────────────

export async function requestSample(req, res, next) {
  try {
    if (!await isFeatureEnabled()) {
      return res.status(403).json({ success: false, error: 'Sample order feature is currently disabled.' });
    }

    const { supplier_id, product_id, quantity, message, shipping_address_id } = req.body;
    const buyerId = req.user.id;

    const config = await getConfig();

    // Eligibility check
    const eligibility = await SampleOrder.checkEligibility(buyerId, product_id, supplier_id, config);
    if (!eligibility.eligible) {
      return res.status(422).json({ success: false, error: eligibility.reason });
    }

    // Determine cost / free sample
    const isFree = false; // enriched by business logic if needed
    const cost = 0;

    const order = await SampleOrder.requestSample({
      buyer_id: buyerId,
      supplier_id,
      product_id,
      quantity: quantity ?? 1,
      message,
      shipping_address_id,
      cost,
      is_free: isFree,
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

// ─── Get sample order by id ─────────────────────────────────────────────────

export async function getSampleOrder(req, res, next) {
  try {
    const order = await SampleOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Sample order not found.' });

    // Only buyer or supplier may view
    const userId = req.user.id;
    if (order.buyer_id !== userId && order.supplier_id !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
}

// ─── Buyer: list my sample requests ─────────────────────────────────────────

export async function getBuyerSamples(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await SampleOrder.getByBuyer(req.user.id, { page: +page, limit: +limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Supplier: list received requests ───────────────────────────────────────

export async function getSupplierSamples(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await SampleOrder.getBySupplier(req.user.id, { page: +page, limit: +limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Supplier: approve ───────────────────────────────────────────────────────

export async function approveSample(req, res, next) {
  try {
    const { supplier_notes, cost, is_free } = req.body;
    const order = await SampleOrder.approveSample(req.params.id, req.user.id, { supplier_notes, cost, is_free });
    res.json({ success: true, data: order });
  } catch (err) {
    const status = err.message === 'Forbidden.' ? 403 : err.message.includes('not found') ? 404 : 422;
    res.status(status).json({ success: false, error: err.message });
  }
}

// ─── Supplier: reject ────────────────────────────────────────────────────────

export async function rejectSample(req, res, next) {
  try {
    const { reason } = req.body;
    const order = await SampleOrder.rejectSample(req.params.id, req.user.id, reason);
    res.json({ success: true, data: order });
  } catch (err) {
    const status = err.message === 'Forbidden.' ? 403 : err.message.includes('not found') ? 404 : 422;
    res.status(status).json({ success: false, error: err.message });
  }
}

// ─── Supplier: mark shipped ──────────────────────────────────────────────────

export async function shipSample(req, res, next) {
  try {
    const { tracking_number } = req.body;
    if (!tracking_number) {
      return res.status(422).json({ success: false, error: 'tracking_number is required.' });
    }
    const order = await SampleOrder.shipSample(req.params.id, req.user.id, tracking_number);
    res.json({ success: true, data: order });
  } catch (err) {
    const status = err.message === 'Forbidden.' ? 403 : err.message.includes('not found') ? 404 : 422;
    res.status(status).json({ success: false, error: err.message });
  }
}

// ─── Buyer: confirm delivery ─────────────────────────────────────────────────

export async function deliverSample(req, res, next) {
  try {
    const order = await SampleOrder.deliverSample(req.params.id, req.user.id);
    res.json({ success: true, data: order });
  } catch (err) {
    const status = err.message === 'Forbidden.' ? 403 : err.message.includes('not found') ? 404 : 422;
    res.status(status).json({ success: false, error: err.message });
  }
}

// ─── Buyer: add feedback ─────────────────────────────────────────────────────

export async function addFeedback(req, res, next) {
  try {
    const { buyer_feedback, buyer_rating } = req.body;
    const order = await SampleOrder.addFeedback(req.params.id, req.user.id, { buyer_feedback, buyer_rating });
    res.json({ success: true, data: order });
  } catch (err) {
    const status = err.message === 'Forbidden.' ? 403 : err.message.includes('not found') ? 404 : 422;
    res.status(status).json({ success: false, error: err.message });
  }
}

// ─── Admin: get config ───────────────────────────────────────────────────────

export async function getAdminConfig(req, res, next) {
  try {
    const config = await getConfig();
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
}

// ─── Admin: update config ────────────────────────────────────────────────────

export async function updateAdminConfig(req, res, next) {
  try {
    const allowedKeys = [
      'max_samples_per_buyer',
      'max_samples_per_product',
      'free_sample_eligible_min_order',
      'auto_approve_verified_suppliers',
      'sample_request_cooldown_days',
      'feature_enabled',
      'mode',
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = String(req.body[key]);
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(422).json({ success: false, error: 'No valid config keys provided.' });
    }

    const rows = await SampleOrderConfig.setMany(updates, req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}
