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
 * List all LCs for a given user (as applicant or beneficiary).
 */
export async function listLCRecords(userId) {
  const { data, error } = await supabase
    .from('letters_of_credit')
    .select('*')
    .or(`applicant_id.eq.${userId},beneficiary_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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

/**
 * Create an LC amendment request.
 */
export async function createLCAmendmentRecord({ lc_id, requested_by, field, new_value, reason }) {
  const { data, error } = await supabase.from('lc_amendments').insert([{
    lc_id,
    requested_by,
    field,
    new_value,
    reason: reason || null,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Escrow ──────────────────────────────────────────────────────────────────

/**
 * Create an escrow payment record.
 */
export async function createEscrowRecord({ buyer_id, seller_id, order_id, amount, currency, conditions, milestones }) {
  const { data, error } = await supabase.from('escrow_payments').insert([{
    buyer_id,
    seller_id: seller_id || null,
    order_id: order_id || null,
    amount,
    currency: currency || 'USD',
    conditions: conditions || null,
    milestones: milestones || null,
    status: 'held',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * List escrow payments for a given user (as buyer or seller).
 */
export async function listEscrowRecords(userId) {
  const { data, error } = await supabase
    .from('escrow_payments')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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

/**
 * File an escrow dispute and update escrow status to 'disputed'.
 */
export async function fileEscrowDisputeRecord({ escrow_id, filed_by, reason, description }) {
  // Mark escrow as disputed
  await supabase.from('escrow_payments')
    .update({ status: 'disputed', updated_at: new Date().toISOString() })
    .eq('id', escrow_id)
    .eq('status', 'held');

  const { data, error } = await supabase.from('escrow_disputes').insert([{
    escrow_id,
    filed_by,
    reason,
    description: description || null,
    status: 'open',
  }]).select().single();

  if (error) throw error;
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

/**
 * List invoice factoring records for a supplier.
 */
export async function listInvoiceFactoringRecords(supplierId) {
  const { data, error } = await supabase
    .from('invoice_factoring')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── PO Financing ─────────────────────────────────────────────────────────────

/**
 * Compute PO financing terms.
 */
export function calculatePOFinancing({ po_amount, advance_pct = 70, interest_rate = 8, term_days = 90 }) {
  const advance_amount  = +(po_amount * (advance_pct / 100)).toFixed(2);
  const interest_amount = +(advance_amount * (interest_rate / 100) * (term_days / 365)).toFixed(2);
  const total_repayment = +(advance_amount + interest_amount).toFixed(2);
  return { advance_amount, interest_amount, total_repayment };
}

/**
 * Create a PO financing application.
 */
export async function createPOFinancingRecord({ supplier_id, po_number, po_amount, buyer_name, delivery_date, advance_pct = 70, interest_rate = 8, term_days = 90, notes }) {
  const terms = calculatePOFinancing({ po_amount, advance_pct, interest_rate, term_days });

  const { data, error } = await supabase.from('po_financing').insert([{
    supplier_id,
    po_number,
    po_amount,
    buyer_name,
    delivery_date,
    advance_pct,
    interest_rate,
    term_days,
    advance_amount: terms.advance_amount,
    interest_amount: terms.interest_amount,
    total_repayment: terms.total_repayment,
    amount_repaid: 0,
    notes: notes || null,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * Get PO financing record by ID.
 */
export async function getPOFinancingById(id) {
  const { data, error } = await supabase.from('po_financing').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/**
 * Record a repayment transaction for a PO financing.
 */
export async function recordPORepaymentTx({ financing_id, amount }) {
  const current = await getPOFinancingById(financing_id);
  const newRepaid = +(current.amount_repaid + amount).toFixed(2);
  const isFullyRepaid = newRepaid >= current.total_repayment;

  const { data, error } = await supabase.from('po_financing')
    .update({
      amount_repaid: newRepaid,
      status: isFullyRepaid ? 'repaid' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', financing_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Currency / Forward Contracts ────────────────────────────────────────────

/**
 * Create a forward contract (locked exchange rate).
 */
export async function createForwardContractRecord({ user_id, from_currency, to_currency, amount, locked_rate, settlement_date }) {
  const converted_amount = +(amount * locked_rate).toFixed(2);

  const { data, error } = await supabase.from('currency_forward_contracts').insert([{
    user_id,
    from_currency,
    to_currency,
    amount,
    locked_rate,
    converted_amount,
    settlement_date,
    status: 'active',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * List forward contracts for a user.
 */
export async function listForwardContractRecords(userId) {
  const { data, error } = await supabase
    .from('currency_forward_contracts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Create a currency rate alert.
 */
export async function createRateAlertRecord({ user_id, from_currency, to_currency, target_rate, direction }) {
  const { data, error } = await supabase.from('currency_rate_alerts').insert([{
    user_id,
    from_currency,
    to_currency,
    target_rate,
    direction,
    triggered: false,
    status: 'active',
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
