/**
 * Globex Sky — pricingController.js
 * Admin pricing & commission management controller.
 */

import supabase from '../config/supabase.js';

/* ─── Commission Settings ─────────────────────────────────────────────── */

/** GET /api/admin/pricing/commissions */
export async function getCommissions(req, res, next) {
  try {
    const { data, error } = await supabase.from('commission_settings').select('*').order('type').order('category');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/commissions */
export async function updateCommissions(req, res, next) {
  try {
    const { settings } = req.body; // Array of commission setting objects
    if (!Array.isArray(settings)) return res.status(400).json({ success: false, error: 'settings must be an array.' });

    const updates = await Promise.all(
      settings.map(s => {
        if (s.id) {
          return supabase.from('commission_settings').update(s).eq('id', s.id).select().single();
        }
        return supabase.from('commission_settings').insert(s).select().single();
      })
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'Commission settings updated.' });
  } catch (err) { next(err); }
}

/* ─── Supplier Plans ──────────────────────────────────────────────────── */

/** GET /api/admin/pricing/supplier-plans */
export async function getSupplierPlans(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_plans').select('*').order('monthly_fee');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/pricing/supplier-plans */
export async function createSupplierPlan(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_plans').insert(req.body).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/supplier-plans/:id */
export async function updateSupplierPlan(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('supplier_plans').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Plan not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/pricing/supplier-plans/:id */
export async function deleteSupplierPlan(req, res, next) {
  try {
    const { error } = await supabase.from('supplier_plans').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Supplier plan deleted.' });
  } catch (err) { next(err); }
}

/* ─── Inspection Pricing ──────────────────────────────────────────────── */

/** GET /api/admin/pricing/inspection */
export async function getInspectionPricing(req, res, next) {
  try {
    const { data, error } = await supabase.from('inspection_pricing').select('*').order('type');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/inspection */
export async function updateInspectionPricing(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });

    const updates = await Promise.all(
      items.map(item =>
        item.id
          ? supabase.from('inspection_pricing').update(item).eq('id', item.id).select().single()
          : supabase.from('inspection_pricing').insert(item).select().single()
      )
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'Inspection pricing updated.' });
  } catch (err) { next(err); }
}

/* ─── Dropshipping Markup ─────────────────────────────────────────────── */

/** GET /api/admin/pricing/dropshipping */
export async function getDropshippingMarkup(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').select('*').order('category').order('min_price');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/dropshipping */
export async function updateDropshippingMarkup(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });

    const updates = await Promise.all(
      items.map(item =>
        item.id
          ? supabase.from('dropshipping_markup').update(item).eq('id', item.id).select().single()
          : supabase.from('dropshipping_markup').insert(item).select().single()
      )
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'Dropshipping markup updated.' });
  } catch (err) { next(err); }
}

/* ─── Carry Service Rates ─────────────────────────────────────────────── */

/** GET /api/admin/pricing/carry-service */
export async function getCarryRates(req, res, next) {
  try {
    const { data, error } = await supabase.from('carry_service_rates').select('*').order('category');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/carry-service */
export async function updateCarryRates(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });

    const updates = await Promise.all(
      items.map(item =>
        item.id
          ? supabase.from('carry_service_rates').update(item).eq('id', item.id).select().single()
          : supabase.from('carry_service_rates').insert(item).select().single()
      )
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'Carry service rates updated.' });
  } catch (err) { next(err); }
}

/* ─── Parcel Service Pricing ──────────────────────────────────────────── */

/** GET /api/admin/pricing/parcel-service */
export async function getParcelPricing(req, res, next) {
  try {
    const { data, error } = await supabase.from('parcel_pricing').select('*').order('country').order('min_weight');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/parcel-service */
export async function updateParcelPricing(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });

    const updates = await Promise.all(
      items.map(item =>
        item.id
          ? supabase.from('parcel_pricing').update(item).eq('id', item.id).select().single()
          : supabase.from('parcel_pricing').insert(item).select().single()
      )
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'Parcel pricing updated.' });
  } catch (err) { next(err); }
}

/* ─── API Pricing Tiers ───────────────────────────────────────────────── */

/** GET /api/admin/pricing/api-plans */
export async function getApiPricingTiers(req, res, next) {
  try {
    const { data, error } = await supabase.from('api_pricing_tiers').select('*').order('monthly_cost');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/pricing/api-plans */
export async function updateApiPricingTiers(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });

    const updates = await Promise.all(
      items.map(item =>
        item.id
          ? supabase.from('api_pricing_tiers').update(item).eq('id', item.id).select().single()
          : supabase.from('api_pricing_tiers').insert(item).select().single()
      )
    );

    const errors = updates.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(400).json({ success: false, errors });

    res.json({ success: true, data: updates.map(r => r.data), message: 'API pricing tiers updated.' });
  } catch (err) { next(err); }
}
