/**
 * Globex Sky — AI Fraud Detection Service
 * Transaction risk scoring, rules-based detection, whitelist/blacklist management,
 * and audit trail logging.
 */

import supabase from '../../config/supabase.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const FRAUD_CONFIG = {
  autoBlockThreshold: 80,       // Risk score >= this will auto-block
  reviewThreshold: 50,           // Risk score >= this flags for review
  velocityWindowMinutes: 60,    // Window for velocity checks
  maxOrdersPerWindow: 5,         // Max orders from same IP in window
  newAccountDays: 7,             // Account age (days) considered "new"
  largeOrderMultiplier: 3,       // Multiplier over avg order to flag as large
};

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

/**
 * Score a transaction for fraud risk (0–100).
 * Higher scores = higher risk.
 * @param {object} transaction - { user_id, order_id, amount, ip_address, billing_address, shipping_address, user_created_at }
 * @returns {{ score: number, flags: string[], action: 'allow'|'review'|'block' }}
 */
export async function scoreTransaction(transaction) {
  const { user_id, order_id, amount, ip_address, billing_address, shipping_address, user_created_at } = transaction;

  let score = 0;
  const flags = [];

  // ── 1. Whitelist / Blacklist check ──────────────────────────────────────────
  const [whitelistHit, blacklistHit] = await Promise.all([
    checkList(user_id, ip_address, 'whitelist'),
    checkList(user_id, ip_address, 'blacklist'),
  ]);

  if (whitelistHit) {
    await logAudit({ user_id, order_id, score: 0, flags: ['whitelisted'], action: 'allow', ip_address });
    return { score: 0, flags: ['whitelisted'], action: 'allow' };
  }
  if (blacklistHit) {
    await logAudit({ user_id, order_id, score: 100, flags: ['blacklisted'], action: 'block', ip_address });
    return { score: 100, flags: ['blacklisted'], action: 'block' };
  }

  // ── 2. Unusual order amount ──────────────────────────────────────────────────
  const avgOrderAmount = await getAverageOrderAmount(user_id);
  if (avgOrderAmount > 0 && amount > avgOrderAmount * FRAUD_CONFIG.largeOrderMultiplier) {
    score += 25;
    flags.push('unusual_order_amount');
  }

  // ── 3. Velocity check (too many orders from same IP in short time) ───────────
  if (ip_address) {
    const recentCount = await getRecentOrderCountByIp(ip_address);
    if (recentCount >= FRAUD_CONFIG.maxOrdersPerWindow) {
      score += 20;
      flags.push('high_velocity_ip');
    }
  }

  // ── 4. Address mismatch (billing vs shipping) ───────────────────────────────
  if (billing_address && shipping_address) {
    const billingCountry = billing_address.country || billing_address.country_code;
    const shippingCountry = shipping_address.country || shipping_address.country_code;
    if (billingCountry && shippingCountry && billingCountry !== shippingCountry) {
      score += 15;
      flags.push('address_country_mismatch');
    }
  }

  // ── 5. New account with large order ────────────────────────────────────────
  if (user_created_at) {
    const accountAgeDays = (Date.now() - new Date(user_created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < FRAUD_CONFIG.newAccountDays && amount > 500) {
      score += 25;
      flags.push('new_account_large_order');
    }
  }

  // ── 6. Multiple failed payment attempts ─────────────────────────────────────
  const failedAttempts = await getRecentFailedPayments(user_id);
  if (failedAttempts >= 3) {
    score += 15;
    flags.push('multiple_failed_payments');
  }

  score = Math.min(score, 100);

  let action = 'allow';
  if (score >= FRAUD_CONFIG.autoBlockThreshold) action = 'block';
  else if (score >= FRAUD_CONFIG.reviewThreshold) action = 'review';

  if (action !== 'allow') {
    await flagTransaction(order_id, user_id, score, flags, action);
  }

  await logAudit({ user_id, order_id, score, flags, action, ip_address });

  return { score, flags, action };
}

// ─── Whitelist / Blacklist Management ────────────────────────────────────────

/**
 * Add a user or IP to the whitelist or blacklist.
 * @param {{ user_id?: string, ip_address?: string, list_type: 'whitelist'|'blacklist', reason?: string }} entry
 */
export async function addToList(entry) {
  const { user_id, ip_address, list_type, reason } = entry;
  const { data, error } = await supabase
    .from('fraud_lists')
    .upsert([{ user_id: user_id || null, ip_address: ip_address || null, list_type, reason: reason || null }], {
      onConflict: 'user_id,ip_address,list_type',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove an entry from the whitelist or blacklist.
 * @param {string} entryId
 */
export async function removeFromList(entryId) {
  const { error } = await supabase.from('fraud_lists').delete().eq('id', entryId);
  if (error) throw error;
}

/**
 * Get all fraud list entries.
 * @param {'whitelist'|'blacklist'|null} listType
 */
export async function getFraudList(listType = null) {
  let query = supabase.from('fraud_lists').select('*').order('created_at', { ascending: false });
  if (listType) query = query.eq('list_type', listType);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── Flagged Transactions ─────────────────────────────────────────────────────

/**
 * Get flagged transactions for admin review.
 * @param {{ status?: string, page?: number, limit?: number }} opts
 */
export async function getFlaggedTransactions({ status = 'pending', page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('fraud_flags')
    .select('*, orders(id, total_amount, user_id)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data || [], total: count, page, limit };
}

/**
 * Update the review status of a flagged transaction.
 * @param {string} flagId
 * @param {'approved'|'rejected'} status
 * @param {string} reviewedBy
 */
export async function reviewFlaggedTransaction(flagId, status, reviewedBy) {
  const { data, error } = await supabase
    .from('fraud_flags')
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', flagId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/**
 * Get fraud audit trail.
 * @param {{ user_id?: string, order_id?: string, page?: number, limit?: number }} opts
 */
export async function getFraudAuditTrail({ user_id, order_id, page = 1, limit = 50 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('fraud_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (user_id) query = query.eq('user_id', user_id);
  if (order_id) query = query.eq('order_id', order_id);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count, page, limit };
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

async function checkList(userId, ipAddress, listType) {
  let query = supabase.from('fraud_lists').select('id').eq('list_type', listType);

  if (userId && ipAddress) {
    // Build separate conditions to avoid string interpolation in .or()
    const { data: byUser } = await supabase
      .from('fraud_lists')
      .select('id')
      .eq('list_type', listType)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (byUser) return true;

    const { data: byIp } = await supabase
      .from('fraud_lists')
      .select('id')
      .eq('list_type', listType)
      .eq('ip_address', ipAddress)
      .limit(1)
      .maybeSingle();

    return !!byIp;
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (ipAddress) {
    query = query.eq('ip_address', ipAddress);
  } else {
    return false;
  }

  const { data } = await query.limit(1).maybeSingle();
  return !!data;
}

async function getAverageOrderAmount(userId) {
  const { data } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .limit(20);

  if (!data?.length) return 0;
  return data.reduce((sum, o) => sum + (o.total_amount || 0), 0) / data.length;
}

async function getRecentOrderCountByIp(ipAddress) {
  const since = new Date(Date.now() - FRAUD_CONFIG.velocityWindowMinutes * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .gte('created_at', since);

  return count || 0;
}

async function getRecentFailedPayments(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'failed')
    .gte('created_at', since);

  return count || 0;
}

async function flagTransaction(orderId, userId, score, flags, action) {
  await supabase.from('fraud_flags').upsert(
    [{ order_id: orderId || null, user_id: userId, risk_score: score, flags, action, status: 'pending' }],
    { onConflict: 'order_id' },
  );
}

async function logAudit(entry) {
  await supabase.from('fraud_audit_log').insert([{
    user_id: entry.user_id || null,
    order_id: entry.order_id || null,
    risk_score: entry.score,
    flags: entry.flags,
    action: entry.action,
    ip_address: entry.ip_address || null,
  }]);
}
