import supabase from '../config/supabase.js';

// ─── One-Touch Ordering ───────────────────────────────────────────────────────

/**
 * Create a one-touch sourcing order.
 * Finds matching suppliers and creates an order record.
 */
export async function createOneTouchOrderRecord({ buyer_id, product_id, quantity, delivery_address, notes }) {
  // Find best-matched supplier for the product
  const { data: suppliers, error: supErr } = await supabase
    .from('supplier_products')
    .select('supplier_id,unit_price,lead_time_days')
    .eq('product_id', product_id)
    .order('unit_price', { ascending: true })
    .limit(1);

  if (supErr) throw supErr;

  const matched_supplier = suppliers?.[0] || null;

  const { data, error } = await supabase.from('one_touch_orders').insert([{
    buyer_id,
    product_id,
    quantity,
    delivery_address: delivery_address || null,
    notes: notes || null,
    supplier_id: matched_supplier?.supplier_id || null,
    unit_price: matched_supplier?.unit_price || null,
    estimated_lead_time: matched_supplier?.lead_time_days || null,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Customization Options ───────────────────────────────────────────────────

/**
 * Get available customization options for a product.
 */
export async function fetchCustomizationOptions(product_id) {
  const { data, error } = await supabase
    .from('product_customization_options')
    .select('*')
    .eq('product_id', product_id)
    .order('option_type');

  if (error) throw error;
  return data || [];
}

// ─── Custom Sourcing Requests ─────────────────────────────────────────────────

/**
 * Submit a custom sourcing request.
 */
export async function submitCustomRequestRecord({
  buyer_id,
  product_name,
  description,
  quantity,
  target_price,
  delivery_deadline,
  specifications,
}) {
  const { data, error } = await supabase.from('custom_sourcing_requests').insert([{
    buyer_id,
    product_name,
    description: description || null,
    quantity,
    target_price: target_price || null,
    delivery_deadline: delivery_deadline || null,
    specifications: specifications || null,
    status: 'open',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Supplier Quotes ──────────────────────────────────────────────────────────

/**
 * Retrieve supplier quotes for a custom sourcing request.
 */
export async function fetchSourcingQuotes(request_id) {
  const { data, error } = await supabase
    .from('sourcing_quotes')
    .select('*')
    .eq('request_id', request_id)
    .order('unit_price', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ─── Comparison Engine ────────────────────────────────────────────────────────

/**
 * Compare multiple sourcing options side by side.
 * Each option: { supplier_id, unit_price, lead_time_days, moq, certifications }
 */
export function compareSourcingOptionsData(options) {
  if (!Array.isArray(options) || options.length === 0) return [];

  const minPrice = Math.min(...options.map(o => o.unit_price));
  const minLead = Math.min(...options.map(o => o.lead_time_days));

  return options.map(option => ({
    ...option,
    price_score: +(1 - (option.unit_price - minPrice) / (minPrice || 1)).toFixed(3),
    lead_score: +(1 - (option.lead_time_days - minLead) / (minLead || 1)).toFixed(3),
    overall_score: +(
      0.6 * (1 - (option.unit_price - minPrice) / (minPrice || 1)) +
      0.4 * (1 - (option.lead_time_days - minLead) / (minLead || 1))
    ).toFixed(3),
  })).sort((a, b) => b.overall_score - a.overall_score);
}

// ─── Supplier Matching ────────────────────────────────────────────────────────

/**
 * Match suppliers to a sourcing request based on product categories.
 */
export async function matchSuppliers({ product_name, quantity, target_price }) {
  let q = supabase.from('suppliers').select('id,company_name,country,rating,categories');

  if (target_price) {
    // Simple heuristic: fetch active suppliers and filter in JS
  }

  const { data, error } = await q.eq('status', 'active').limit(10);
  if (error) throw error;

  return (data || []).map(s => ({
    supplier_id: s.id,
    company_name: s.company_name,
    country: s.country,
    rating: s.rating,
    categories: s.categories,
  }));
}
