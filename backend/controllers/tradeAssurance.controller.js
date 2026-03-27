/**
 * Trade Assurance Controller
 *
 * Handles: claim filing, claim resolution, policy listing,
 * supplier deposits, and admin config management.
 */

import {
  TradeAssurancePolicy,
  TradeAssuranceClaim,
  TradeAssuranceDeposit,
  TradeAssuranceConfig,
} from '../models/TradeAssurance.js';

// ─── Policies ────────────────────────────────────────────────────────────────

/** GET /api/v1/trade-assurance/policies */
export async function listPolicies(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await TradeAssurancePolicy.findActive({
      page: Number(page),
      limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-assurance/policies/:id */
export async function getPolicy(req, res, next) {
  try {
    const policy = await TradeAssurancePolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    res.json({ success: true, data: policy });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-assurance/policies (admin) */
export async function createPolicy(req, res, next) {
  try {
    const { name, description, coverage_pct, max_amount, duration_days, terms } = req.body;
    const policy = await TradeAssurancePolicy.create({
      name,
      description,
      coverage_pct,
      max_amount,
      duration_days,
      terms,
    });
    res.status(201).json({ success: true, data: policy });
  } catch (err) { next(err); }
}

/** PUT /api/v1/trade-assurance/policies/:id (admin) */
export async function updatePolicy(req, res, next) {
  try {
    const { name, description, coverage_pct, max_amount, duration_days, terms, is_active } = req.body;
    const policy = await TradeAssurancePolicy.update(req.params.id, {
      name,
      description,
      coverage_pct,
      max_amount,
      duration_days,
      terms,
      is_active,
    });
    res.json({ success: true, data: policy });
  } catch (err) { next(err); }
}

// ─── Claims ───────────────────────────────────────────────────────────────────

/** POST /api/v1/trade-assurance/claims */
export async function fileClaim(req, res, next) {
  try {
    const buyer_id = req.user.id;
    const {
      policy_id,
      order_id,
      supplier_id,
      claim_amount,
      reason,
      description,
      evidence_urls,
    } = req.body;

    // Respect current mode (test vs live)
    const is_test_mode = await TradeAssuranceConfig.isTestMode();

    const claim = await TradeAssuranceClaim.fileClaim({
      policy_id: policy_id ?? null,
      order_id,
      buyer_id,
      supplier_id: supplier_id ?? null,
      claim_amount,
      reason,
      description: description ?? null,
      evidence_urls: evidence_urls ?? [],
      is_test_mode,
    });

    // Auto-approve if below threshold
    const threshold = parseFloat(await TradeAssuranceConfig.getValue('auto_approve_threshold') ?? '0');
    if (claim_amount <= threshold) {
      await TradeAssuranceClaim.resolveClaim(claim.id, {
        status: 'approved',
        resolution: 'Auto-approved (below auto-approve threshold)',
        resolution_amount: claim_amount,
        resolved_by: null,
      });
      claim.status = 'approved';
    }

    res.status(201).json({ success: true, data: claim });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-assurance/claims/:id */
export async function getClaim(req, res, next) {
  try {
    const claim = await TradeAssuranceClaim.findById(req.params.id);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    res.json({ success: true, data: claim });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-assurance/claims (buyer: own claims; admin: all) */
export async function listClaims(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const opts = { page: Number(page), limit: Number(limit) };
    const isAdmin = req.user?.role === 'admin';

    let result;
    if (isAdmin) {
      result = status
        ? await TradeAssuranceClaim.findByStatus(status, opts)
        : await TradeAssuranceClaim.findAll(opts);
    } else {
      const filters = status ? { status } : {};
      result = await TradeAssuranceClaim.findByBuyer(req.user.id, { ...opts, filters });
    }
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/** PUT /api/v1/trade-assurance/claims/:id/resolve (admin) */
export async function resolveClaim(req, res, next) {
  try {
    const { status, resolution, resolution_amount } = req.body;
    const resolved_by = req.user.id;
    const claim = await TradeAssuranceClaim.resolveClaim(req.params.id, {
      status,
      resolution,
      resolution_amount,
      resolved_by,
    });
    res.json({ success: true, data: claim });
  } catch (err) { next(err); }
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

/** POST /api/v1/trade-assurance/deposits */
export async function createDeposit(req, res, next) {
  try {
    const { supplier_id, amount, currency, reference, notes } = req.body;
    const deposit = await TradeAssuranceDeposit.create({
      supplier_id: supplier_id ?? req.user.id,
      amount,
      currency: currency ?? 'USD',
      reference: reference ?? null,
      notes: notes ?? null,
      status: 'held',
    });
    res.status(201).json({ success: true, data: deposit });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-assurance/deposits */
export async function listDeposits(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const opts = { page: Number(page), limit: Number(limit) };
    const isAdmin = req.user?.role === 'admin';
    const result = isAdmin
      ? await TradeAssuranceDeposit.findAll(opts)
      : await TradeAssuranceDeposit.findBySupplier(req.user.id, opts);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/** PUT /api/v1/trade-assurance/deposits/:id/release (admin) */
export async function releaseDeposit(req, res, next) {
  try {
    const deposit = await TradeAssuranceDeposit.releaseDeposit(req.params.id);
    res.json({ success: true, data: deposit });
  } catch (err) { next(err); }
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** GET /api/v1/trade-assurance/config */
export async function getConfig(req, res, next) {
  try {
    const config = await TradeAssuranceConfig.getAll();
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
}

/** PUT /api/v1/trade-assurance/config (admin) */
export async function updateConfig(req, res, next) {
  try {
    const updatedBy = req.user.id;
    const config = await TradeAssuranceConfig.setMany(req.body, updatedBy);
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
}
