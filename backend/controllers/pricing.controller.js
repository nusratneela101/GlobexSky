import supabase from '../config/supabase.js';
import { calculateCommissionAmount } from '../services/commission.service.js';
import { calculateShippingRate } from '../services/shipping.service.js';
import { calculateMarkup } from '../services/pricing.service.js';

export async function getShippingRates(req, res, next) {
  try {
    const { data, error } = await supabase.from('shipping_rates').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCarryRates(req, res, next) {
  try {
    const { data, error } = await supabase.from('carry_rates').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getInspectionPricing(req, res, next) {
  try {
    const { data, error } = await supabase.from('inspection_pricing').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierPlans(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_plans').select('*').eq('is_active', true).order('sort_order');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getApiPlans(req, res, next) {
  try {
    const { data, error } = await supabase.from('api_plans').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getAdvertisingPricing(req, res, next) {
  try {
    const { data, error } = await supabase.from('advertising_pricing').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function calculateCommission(req, res, next) {
  try {
    const { order_value, category_id } = req.body;
    const commission = await calculateCommissionAmount(order_value, category_id);
    res.json({ success: true, data: commission });
  } catch (err) { next(err); }
}

export async function calculateShipping(req, res, next) {
  try {
    const result = await calculateShippingRate(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function calculateCarryPayment(req, res, next) {
  try {
    const { product_category, weight_kg, fragile } = req.body;
    const { data: rate } = await supabase.from('carry_rates').select('payment_per_kg,fragile_surcharge').eq('product_category', product_category).single();
    const base = (rate?.payment_per_kg || 5) * weight_kg;
    const fragileAdd = fragile ? (rate?.fragile_surcharge || 0) : 0;
    res.json({ success: true, data: { base, fragile_surcharge: fragileAdd, total: base + fragileAdd } });
  } catch (err) { next(err); }
}

export async function calculateDropshippingMarkup(req, res, next) {
  try {
    const { supplier_price, category_id } = req.body;
    const result = await calculateMarkup(supplier_price, category_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function updateCommissionSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('commission_settings').upsert(req.body, { onConflict: 'id' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateShippingRate(req, res, next) {
  try {
    const { data, error } = await supabase.from('shipping_rates').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateSupplierPlan(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_plans').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
