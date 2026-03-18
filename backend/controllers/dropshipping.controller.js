import supabase from '../config/supabase.js';
import { calculateMarkup } from '../services/pricing.service.js';

export async function getDashboard(req, res, next) {
  try {
    const { data: products, count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active');
    res.json({ success: true, data: { total_products: count } });
  } catch (err) { next(err); }
}

export async function listDropshippingProducts(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(400).json({ success: false, error: error.message });
    // Compute markup for each product
    const enriched = await Promise.all((data || []).map(async (p) => {
      const markup = await calculateMarkup(p.price, p.category_id);
      return { ...p, dropship_price: markup.selling_price, profit: markup.profit };
    }));
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
}

export async function importProduct(req, res, next) {
  try {
    const { product_id } = req.body;
    const { data: product } = await supabase.from('products').select('*').eq('id', product_id).single();
    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data: product, message: 'Product imported to your store.' });
  } catch (err) { next(err); }
}

export async function getMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').upsert(req.body, { onConflict: 'id' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getInventorySync(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('id,title,stock,updated_at').eq('status', 'active');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function syncInventory(req, res, next) {
  try {
    // Placeholder for real inventory sync logic
    res.json({ success: true, message: 'Inventory sync triggered.', synced_at: new Date().toISOString() });
  } catch (err) { next(err); }
}
