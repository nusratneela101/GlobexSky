import supabase from '../config/supabase.js';

/**
 * Compute a fraud risk score (0–100) for a COD order.
 * Higher score = higher risk.
 * @param {object} params
 */
export function computeFraudScore({ orderValue, buyerOrderCount, returnRate, addressMismatch, multipleOrdersSameDay }) {
  let score = 0;

  // Large order value without purchase history
  if (orderValue > 500 && buyerOrderCount < 2) score += 30;
  else if (orderValue > 200 && buyerOrderCount < 1) score += 20;

  // High return rate
  if (returnRate > 0.5) score += 30;
  else if (returnRate > 0.3) score += 15;

  // Billing/shipping address mismatch
  if (addressMismatch) score += 20;

  // Multiple COD orders placed on the same day
  if (multipleOrdersSameDay >= 3) score += 20;
  else if (multipleOrdersSameDay >= 2) score += 10;

  return Math.min(score, 100);
}

/**
 * Create a new COD order record in `cod_orders` table.
 * @param {object} orderData
 */
export async function createCodOrderRecord(orderData) {
  const {
    order_id,
    buyer_id,
    carrier_id,
    amount,
    address,
    notes,
  } = orderData;

  // Gather buyer history for fraud scoring
  const [ordersRes, returnsRes, sameDayRes] = await Promise.all([
    supabase.from('cod_orders').select('id', { count: 'exact', head: true }).eq('buyer_id', buyer_id),
    supabase.from('cod_orders').select('id', { count: 'exact', head: true }).eq('buyer_id', buyer_id).eq('status', 'returned'),
    supabase.from('cod_orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyer_id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const buyerOrderCount = ordersRes.count || 0;
  const returnCount = returnsRes.count || 0;
  const returnRate = buyerOrderCount > 0 ? returnCount / buyerOrderCount : 0;
  const multipleOrdersSameDay = sameDayRes.count || 0;

  const fraud_score = computeFraudScore({
    orderValue: amount,
    buyerOrderCount,
    returnRate,
    addressMismatch: false,
    multipleOrdersSameDay,
  });

  const is_flagged = fraud_score >= 60;

  const { data, error } = await supabase.from('cod_orders').insert([{
    order_id,
    buyer_id,
    carrier_id: carrier_id || null,
    amount,
    address: address || null,
    notes: notes || null,
    fraud_score,
    is_flagged,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * Confirm that a COD parcel was delivered to the buyer.
 * @param {string} codOrderId
 * @param {string} carrierId
 */
export async function confirmDelivery(codOrderId, carrierId) {
  const { data, error } = await supabase
    .from('cod_orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', codOrderId)
    .eq('carrier_id', carrierId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Confirm that cash was collected from the buyer and remitted.
 * @param {string} codOrderId
 */
export async function confirmCollection(codOrderId) {
  const { data, error } = await supabase
    .from('cod_orders')
    .update({ status: 'collected', collected_at: new Date().toISOString() })
    .eq('id', codOrderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark a COD order as fraudulent and flag it.
 * @param {string} codOrderId
 * @param {string} reason
 */
export async function markFraudulent(codOrderId, reason) {
  const { data, error } = await supabase
    .from('cod_orders')
    .update({ is_flagged: true, fraud_reason: reason || null, status: 'flagged' })
    .eq('id', codOrderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Reconciliation report: totals by status.
 */
export async function buildReconciliationReport({ start, end } = {}) {
  let query = supabase.from('cod_orders').select('status,amount,fraud_score,is_flagged,created_at');
  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  const orders = data || [];
  const summary = orders.reduce((acc, o) => {
    acc.total_orders += 1;
    acc.total_amount += +o.amount;
    acc[o.status] = (acc[o.status] || 0) + 1;
    if (o.is_flagged) acc.flagged += 1;
    return acc;
  }, { total_orders: 0, total_amount: 0, flagged: 0, pending: 0, delivered: 0, collected: 0, returned: 0 });

  summary.total_amount = +summary.total_amount.toFixed(2);
  return { summary, orders };
}

/**
 * Analytics: breakdown of COD orders over time.
 */
export async function getCodAnalyticsData({ start, end } = {}) {
  let query = supabase.from('cod_orders').select('status,amount,fraud_score,is_flagged,created_at,delivered_at,collected_at');
  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  const orders = data || [];
  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const totalCodAmount = orders.reduce((s, o) => s + (+o.amount), 0);
  const collectedAmount = orders.filter(o => o.status === 'collected').reduce((s, o) => s + (+o.amount), 0);
  const avgFraudScore = orders.length > 0
    ? +(orders.reduce((s, o) => s + (+o.fraud_score), 0) / orders.length).toFixed(1)
    : 0;

  return {
    total_orders: orders.length,
    total_cod_amount: +totalCodAmount.toFixed(2),
    collected_amount: +collectedAmount.toFixed(2),
    avg_fraud_score: avgFraudScore,
    flagged_count: orders.filter(o => o.is_flagged).length,
    by_status: byStatus,
  };
}
