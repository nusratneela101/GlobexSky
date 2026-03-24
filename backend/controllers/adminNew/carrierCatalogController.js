/**
 * Admin Carrier Catalog Controller
 * Manages carrier product categories, rates, surge rules, and bonus structures.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/carrier-catalog — list all carrier product categories with rates */
export async function getCarrierProducts(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('carrier_products')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/carrier-catalog — add new product category with $/kg rate */
export async function createCarrierProduct(req, res, next) {
  try {
    const { name, description, rate_per_kg, currency = 'USD', category, is_active = true } = req.body;
    if (!name || !rate_per_kg) {
      return res.status(400).json({ success: false, error: 'name and rate_per_kg are required.' });
    }

    const { data, error } = await supabase
      .from('carrier_products')
      .insert({ name, description, rate_per_kg, currency, category, is_active, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/carrier-catalog/:id — update rates, bonus rules */
export async function updateCarrierProduct(req, res, next) {
  try {
    const { name, description, rate_per_kg, currency, category, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (rate_per_kg !== undefined) updates.rate_per_kg = rate_per_kg;
    if (currency !== undefined) updates.currency = currency;
    if (category !== undefined) updates.category = category;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('carrier_products')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/carrier-catalog/:id */
export async function deleteCarrierProduct(req, res, next) {
  try {
    const { error } = await supabase.from('carrier_products').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Carrier product deleted.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/carrier-catalog/:id/surge-rules — set peak season/holiday surge multipliers */
export async function setSurgeRules(req, res, next) {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'rules array is required.' });
    }

    const { data, error } = await supabase
      .from('carrier_products')
      .update({ surge_rules: rules, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/carrier-catalog/bonus-rules — list carrier bonus structures */
export async function getBonusRules(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('carrier_bonus_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** PUT /api/admin/carrier-catalog/bonus-rules — configure monthly delivery bonuses */
export async function setBonusRules(req, res, next) {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'rules array is required.' });
    }

    // Upsert bonus rules (replace all current rules)
    const { error: deleteError } = await supabase.from('carrier_bonus_rules').delete().neq('id', '');
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    const toInsert = rules.map((rule) => ({ ...rule, created_at: new Date().toISOString() }));
    const { data, error } = await supabase.from('carrier_bonus_rules').insert(toInsert).select();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** GET /api/admin/carrier-catalog/payments/:carrierId — payment records for a carrier */
export async function getCarrierPaymentHistory(req, res, next) {
  try {
    const { carrierId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('carrier_payments')
      .select('*', { count: 'exact' })
      .eq('carrier_id', carrierId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}
