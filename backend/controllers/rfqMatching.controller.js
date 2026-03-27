/**
 * RFQ Matching Controller
 */

import supabase from '../config/supabase.js';
import RFQMatch from '../models/RFQMatch.js';
import * as svc from '../services/rfqMatching.service.js';

// ─── Trigger Matching ────────────────────────────────────────────────────────

export async function triggerMatching(req, res, next) {
  try {
    const { rfqId } = req.params;
    const matches = await svc.runMatching(rfqId);
    res.json({ success: true, data: matches, total: matches.length });
  } catch (err) {
    if (err.message === 'RFQ auto-matching is currently disabled.') {
      return res.status(403).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// ─── Get Matches ─────────────────────────────────────────────────────────────

export async function getMatches(req, res, next) {
  try {
    const { rfqId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const result = await RFQMatch.getMatches(rfqId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Supplier's Matched RFQs ────────────────────────────────────────────────

export async function supplierMatches(req, res, next) {
  try {
    // Get supplier profile for the authenticated user
    const { data: profile } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();
    if (!profile) return res.status(404).json({ success: false, error: 'Supplier profile not found.' });

    const { page = 1, limit = 20 } = req.query;
    const from = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const to = from + parseInt(limit, 10) - 1;

    const { data, error, count } = await supabase
      .from('rfq_matches')
      .select('*, rfq:rfqs(id, product_name, description, quantity, unit, target_price, currency, category_id, deadline, status)', { count: 'exact' })
      .eq('supplier_id', profile.id)
      .order('match_score', { ascending: false })
      .range(from, to);
    if (error) throw error;

    res.json({ success: true, data: data ?? [], total: count ?? 0, page: +page, limit: +limit });
  } catch (err) { next(err); }
}

// ─── Mark Match as Viewed ────────────────────────────────────────────────────

export async function markViewed(req, res, next) {
  try {
    const { matchId } = req.params;
    const { data, error } = await supabase
      .from('rfq_matches')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', matchId)
      .in('status', ['pending', 'notified'])
      .select()
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Match not found or already viewed.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Marketplace: List ───────────────────────────────────────────────────────

export async function getMarketplace(req, res, next) {
  try {
    const { page = 1, limit = 20, category_id, urgency } = req.query;
    const filters = {};
    if (category_id) filters.category_id = category_id;
    if (urgency) filters.urgency = urgency;

    const result = await RFQMatch.getMarketplaceRFQs(filters, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Marketplace: Publish ────────────────────────────────────────────────────

export async function publishMarketplace(req, res, next) {
  try {
    const { rfqId } = req.params;
    const payload = req.body;
    const data = await svc.publishToMarketplace(rfqId, payload);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Admin Config: Get ───────────────────────────────────────────────────────

export async function getConfig(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('rfq_match_config')
      .select('id, key, value, description, is_encrypted, updated_at')
      .order('key');
    if (error) throw error;

    // Mask encrypted values in the response
    const safe = (data ?? []).map((row) => ({
      ...row,
      value: row.is_encrypted && row.value ? '••••••••' : row.value,
    }));

    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
}

// ─── Admin Config: Update ────────────────────────────────────────────────────

export async function updateConfig(req, res, next) {
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be a key-value object.' });
    }

    const config = await svc.updateConfig(updates, req.user?.id);
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
}

// ─── Admin Config: Test Matching ─────────────────────────────────────────────

export async function testMatchingConfig(req, res, next) {
  try {
    // Merge saved config with any overrides sent in the request body
    const saved = await svc.loadConfig();
    const overrides = req.body ?? {};
    const testConfig = { ...saved, ...overrides };

    const result = await svc.testMatching(testConfig);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
