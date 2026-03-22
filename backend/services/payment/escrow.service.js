/**
 * Globex Sky — escrow.service.js
 * Trade Assurance / Escrow service.
 *
 * Supports:
 *  - Create escrow transaction
 *  - Hold funds
 *  - Release on milestone completion
 *  - Release on delivery confirmation
 *  - Dispute handling
 *  - Partial release
 *  - Auto-release after timeout
 */

import { v4 as uuidv4 } from 'uuid';
import supabase from '../../config/supabase.js';
import { escrowConfig } from '../../config/integrations.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _autoReleaseDate() {
  const d = new Date();
  d.setDate(d.getDate() + escrowConfig.autoReleaseAfterDays);
  return d.toISOString();
}

function _disputeDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + escrowConfig.disputeWindowDays);
  return d.toISOString();
}

// ─── External Escrow.com integration (optional) ───────────────────────────────

async function _escrowApiRequest(method, path, body) {
  if (escrowConfig.provider !== 'escrow.com') return null;
  const res = await fetch(`${escrowConfig.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${escrowConfig.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Escrow.com ${method} ${path} failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new escrow transaction.
 * @param {object} opts
 * @param {string}   opts.orderId           - Platform order UUID
 * @param {string}   opts.buyerId           - Platform user UUID
 * @param {string}   opts.supplierId        - Platform supplier UUID
 * @param {number}   opts.amount            - Total escrow amount (decimal)
 * @param {string}   [opts.currency='USD']
 * @param {Array}    [opts.milestones]       - Optional milestone schedule
 * @returns {object} Created escrow record
 */
export async function createEscrowTransaction({ orderId, buyerId, supplierId, amount, currency = 'USD', milestones = [] }) {
  const escrowId = uuidv4();
  const now = new Date().toISOString();

  const record = {
    id: escrowId,
    order_id: orderId,
    buyer_id: buyerId,
    supplier_id: supplierId,
    amount: parseFloat(amount),
    amount_released: 0,
    currency: currency.toUpperCase(),
    status: 'pending',
    milestones: milestones.length ? milestones : null,
    auto_release_at: _autoReleaseDate(),
    dispute_deadline: _disputeDeadline(),
    created_at: now,
    updated_at: now,
  };

  if (escrowConfig.provider === 'escrow.com') {
    const external = await _escrowApiRequest('POST', '/transaction', {
      parties: [
        { role: 'buyer', customer: buyerId },
        { role: 'seller', customer: supplierId },
      ],
      currency: currency.toLowerCase(),
      items: [{ title: `Order ${orderId}`, type: 'general_merchandise', amount, quantity: 1 }],
    });
    record.external_escrow_id = external?.id;
  }

  const { data, error } = await supabase.from('escrow_transactions').insert(record).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Mark escrow funds as held (buyer has paid into escrow).
 * @param {string} escrowId
 * @param {string} paymentReference - Stripe/PayPal payment ID
 */
export async function holdFunds(escrowId, paymentReference) {
  const { data, error } = await supabase
    .from('escrow_transactions')
    .update({ status: 'held', payment_reference: paymentReference, updated_at: new Date().toISOString() })
    .eq('id', escrowId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Release escrow funds (full or partial) to the supplier.
 * @param {string}  escrowId
 * @param {number}  [releaseAmount] - Decimal; omit to release all remaining
 * @param {string}  [reason]        - e.g. 'delivery_confirmed', 'milestone_1'
 * @returns {object} Updated escrow record
 */
export async function releaseFunds(escrowId, releaseAmount, reason = 'delivery_confirmed') {
  const { data: escrow, error: fetchErr } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('id', escrowId)
    .single();

  if (fetchErr || !escrow) throw new Error('Escrow transaction not found.');
  if (!['held', 'partial'].includes(escrow.status)) throw new Error(`Cannot release from status: ${escrow.status}`);

  const toRelease = releaseAmount != null
    ? Math.min(parseFloat(releaseAmount), escrow.amount - escrow.amount_released)
    : (escrow.amount - escrow.amount_released);

  const newReleased = parseFloat((escrow.amount_released + toRelease).toFixed(4));
  const newStatus = newReleased >= escrow.amount ? 'released' : 'partial';

  await supabase.from('escrow_release_log').insert({
    escrow_id: escrowId,
    amount: toRelease,
    reason,
    released_at: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from('escrow_transactions')
    .update({ amount_released: newReleased, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', escrowId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Release escrow on milestone completion.
 * @param {string} escrowId
 * @param {string} milestoneId
 */
export async function releaseMilestone(escrowId, milestoneId) {
  const { data: escrow } = await supabase.from('escrow_transactions').select('milestones, amount').eq('id', escrowId).single();
  if (!escrow?.milestones) throw new Error('No milestones defined for this escrow.');

  const milestone = escrow.milestones.find(m => m.id === milestoneId);
  if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);
  if (milestone.released) throw new Error('Milestone already released.');

  const milestoneAmount = parseFloat(milestone.amount || 0);
  await releaseFunds(escrowId, milestoneAmount, `milestone_${milestoneId}`);

  // Mark milestone as released
  const updatedMilestones = escrow.milestones.map(m =>
    m.id === milestoneId ? { ...m, released: true, released_at: new Date().toISOString() } : m,
  );
  await supabase.from('escrow_transactions').update({ milestones: updatedMilestones }).eq('id', escrowId);
  return { success: true, milestoneId, released: milestoneAmount };
}

/**
 * Open a dispute for an escrow transaction.
 * @param {string}  escrowId
 * @param {string}  raisedBy   - User ID of the party raising the dispute
 * @param {string}  reason
 * @param {string}  [details]
 */
export async function openDispute(escrowId, raisedBy, reason, details = '') {
  const { data: escrow, error: fetchErr } = await supabase
    .from('escrow_transactions')
    .select('status, dispute_deadline')
    .eq('id', escrowId)
    .single();

  if (fetchErr || !escrow) throw new Error('Escrow transaction not found.');
  if (escrow.status === 'released') throw new Error('Cannot dispute a fully released escrow.');
  if (new Date(escrow.dispute_deadline) < new Date()) throw new Error('Dispute window has closed.');

  const { data, error } = await supabase.from('escrow_disputes').insert({
    escrow_id: escrowId,
    raised_by: raisedBy,
    reason,
    details,
    status: 'open',
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) throw new Error(error.message);

  await supabase.from('escrow_transactions').update({ status: 'disputed', updated_at: new Date().toISOString() }).eq('id', escrowId);
  return data;
}

/**
 * Resolve a dispute (admin action).
 * @param {string} disputeId
 * @param {string} resolution - 'buyer' | 'supplier' | 'split'
 * @param {number} [buyerRefundPct] - Percentage refunded to buyer (0-100) if split
 */
export async function resolveDispute(disputeId, resolution, buyerRefundPct = 50) {
  const { data: dispute } = await supabase.from('escrow_disputes').select('escrow_id').eq('id', disputeId).single();
  if (!dispute) throw new Error('Dispute not found.');

  const { data: escrow } = await supabase.from('escrow_transactions')
    .select('amount, amount_released, buyer_id, supplier_id')
    .eq('id', dispute.escrow_id).single();

  const remaining = parseFloat((escrow.amount - escrow.amount_released).toFixed(4));

  if (resolution === 'supplier') {
    await releaseFunds(dispute.escrow_id, remaining, 'dispute_resolved_supplier');
  } else if (resolution === 'buyer') {
    await supabase.from('escrow_transactions').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', dispute.escrow_id);
  } else {
    // split
    const supplierShare = parseFloat((remaining * (1 - buyerRefundPct / 100)).toFixed(4));
    if (supplierShare > 0) await releaseFunds(dispute.escrow_id, supplierShare, 'dispute_split_supplier');
    await supabase.from('escrow_transactions').update({ status: supplierShare >= remaining ? 'released' : 'partial_refund', updated_at: new Date().toISOString() }).eq('id', dispute.escrow_id);
  }

  await supabase.from('escrow_disputes').update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() }).eq('id', disputeId);
  return { success: true, resolution };
}

/**
 * Auto-release escrow transactions that have passed their auto-release date.
 * Intended to be called by a cron job.
 * @returns {{ released: number, errors: number }}
 */
export async function processAutoReleases() {
  const { data: due, error } = await supabase
    .from('escrow_transactions')
    .select('id')
    .in('status', ['held', 'partial'])
    .lte('auto_release_at', new Date().toISOString());

  if (error) throw new Error(error.message);
  let released = 0;
  let errors = 0;

  for (const { id } of due || []) {
    try {
      await releaseFunds(id, undefined, 'auto_release_timeout');
      released++;
    } catch (_) {
      errors++;
    }
  }

  return { released, errors };
}
