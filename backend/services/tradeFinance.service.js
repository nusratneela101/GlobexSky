import supabase from '../config/supabase.js';

// ─── LC Status Workflow ──────────────────────────────────────────────────────
const LC_STATUSES = ['draft', 'issued', 'accepted', 'fulfilled', 'closed'];

/**
 * Create a new Letter of Credit record.
 */
export async function createLCRecord({ applicant_id, beneficiary_id, amount, currency, expiry_date, terms, goods_description }) {
  const { data, error } = await supabase.from('letters_of_credit').insert([{
    applicant_id,
    beneficiary_id: beneficiary_id || null,
    amount,
    currency: currency || 'USD',
    expiry_date,
    terms: terms || null,
    goods_description: goods_description || null,
    status: 'draft',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * Fetch LC details by ID.
 */
export async function getLCById(id) {
  const { data, error } = await supabase.from('letters_of_credit').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/**
 * Advance an LC through the status workflow.
 * Only forward transitions are allowed: draft → issued → accepted → fulfilled → closed
 */
export async function advanceLCStatus(id, newStatus) {
  const current = await getLCById(id);
  const currentIdx = LC_STATUSES.indexOf(current.status);
  const newIdx = LC_STATUSES.indexOf(newStatus);

  if (newIdx === -1) throw new Error(`Invalid status: ${newStatus}`);
  if (newIdx !== currentIdx + 1 && newStatus !== 'closed') {
    throw new Error(`Cannot transition from '${current.status}' to '${newStatus}'`);
  }

  const { data, error } = await supabase.from('letters_of_credit')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Escrow ──────────────────────────────────────────────────────────────────

/**
 * Create an escrow payment record.
 */
export async function createEscrowRecord({ buyer_id, seller_id, order_id, amount, currency, conditions }) {
  const { data, error } = await supabase.from('escrow_payments').insert([{
    buyer_id,
    seller_id: seller_id || null,
    order_id: order_id || null,
    amount,
    currency: currency || 'USD',
    conditions: conditions || null,
    status: 'held',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * Release escrow funds to the seller.
 */
export async function releaseEscrowFunds(id) {
  const { data, error } = await supabase.from('escrow_payments')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'held')
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Escrow not found or not in held status');
  return data;
}

/**
 * Refund escrow back to the buyer.
 */
export async function refundEscrow(id) {
  const { data, error } = await supabase.from('escrow_payments')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'held')
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Escrow not found or not in held status');
  return data;
}

// ─── Invoice Factoring ───────────────────────────────────────────────────────

/**
 * Calculate factoring terms.
 * advance_rate: percentage of invoice paid upfront (default 80%)
 * discount_fee: factoring fee (default 3%)
 */
export function calculateFactoring({ invoice_amount, advance_rate = 0.80, discount_fee_rate = 0.03 }) {
  const advance_amount = +(invoice_amount * advance_rate).toFixed(2);
  const discount_fee = +(invoice_amount * discount_fee_rate).toFixed(2);
  const reserve_amount = +(invoice_amount - advance_amount).toFixed(2);
  const net_proceeds = +(advance_amount - discount_fee).toFixed(2);
  return { advance_amount, discount_fee, reserve_amount, net_proceeds };
}

/**
 * Create an invoice factoring record.
 */
export async function createInvoiceFactoringRecord({ supplier_id, invoice_number, invoice_amount, debtor_name, due_date, advance_rate, discount_fee_rate }) {
  const terms = calculateFactoring({ invoice_amount, advance_rate, discount_fee_rate });

  const { data, error } = await supabase.from('invoice_factoring').insert([{
    supplier_id,
    invoice_number,
    invoice_amount,
    debtor_name,
    due_date,
    advance_rate: advance_rate || 0.80,
    discount_fee_rate: discount_fee_rate || 0.03,
    advance_amount: terms.advance_amount,
    discount_fee: terms.discount_fee,
    reserve_amount: terms.reserve_amount,
    net_proceeds: terms.net_proceeds,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────

/**
 * Compute a simple risk score (0–100) for a trade finance transaction.
 */
export function assessRisk({ amount, counterparty_history, country_risk_score = 0, expiry_days }) {
  let score = 0;

  if (amount > 500000) score += 30;
  else if (amount > 100000) score += 15;

  if (counterparty_history < 1) score += 25;
  else if (counterparty_history < 3) score += 10;

  score += Math.min(country_risk_score, 30);

  if (expiry_days < 30) score += 15;
  else if (expiry_days < 90) score += 5;

  return Math.min(score, 100);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Aggregate trade finance analytics across LCs, escrow, and invoice factoring.
 */
export async function getTradeFinanceAnalyticsData({ start, end } = {}) {
  const buildQuery = (table) => {
    let q = supabase.from(table).select('status,amount,created_at');
    if (start) q = q.gte('created_at', start);
    if (end) q = q.lte('created_at', end);
    return q;
  };

  const [lcRes, escrowRes, factoringRes] = await Promise.all([
    buildQuery('letters_of_credit'),
    buildQuery('escrow_payments'),
    supabase.from('invoice_factoring').select('status,invoice_amount,net_proceeds,created_at'),
  ]);

  if (lcRes.error) throw lcRes.error;
  if (escrowRes.error) throw escrowRes.error;
  if (factoringRes.error) throw factoringRes.error;

  const lcOrders = lcRes.data || [];
  const escrowOrders = escrowRes.data || [];
  const factoringOrders = factoringRes.data || [];

  return {
    lc: {
      total: lcOrders.length,
      total_value: +lcOrders.reduce((s, r) => s + (+r.amount), 0).toFixed(2),
      by_status: lcOrders.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    },
    escrow: {
      total: escrowOrders.length,
      total_held: +escrowOrders.filter(r => r.status === 'held').reduce((s, r) => s + (+r.amount), 0).toFixed(2),
      total_released: +escrowOrders.filter(r => r.status === 'released').reduce((s, r) => s + (+r.amount), 0).toFixed(2),
      by_status: escrowOrders.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    },
    invoice_factoring: {
      total: factoringOrders.length,
      total_invoice_value: +factoringOrders.reduce((s, r) => s + (+r.invoice_amount), 0).toFixed(2),
      total_net_proceeds: +factoringOrders.reduce((s, r) => s + (+r.net_proceeds), 0).toFixed(2),
      by_status: factoringOrders.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    },
  };
}
