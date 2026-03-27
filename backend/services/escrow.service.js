/**
 * backend/services/escrow.service.js
 *
 * Business logic for the Escrow Payment System.
 * - Fund holding / release / refund processing
 * - Auto-release timer (runs once on startup and re-checks hourly)
 * - Milestone completion verification
 * - Gateway config read from DB (escrow_config table), never from .env
 */

import Escrow from '../models/Escrow.js';
import { encrypt, decrypt } from '../config/dynamicConfig.js';

// ─── Config helpers ───────────────────────────────────────────────────────────

/**
 * Read all escrow config from DB and return as a plain key→value map.
 * Encrypted values are decrypted transparently.
 * @returns {Promise<Record<string, string>>}
 */
export async function getEscrowConfig() {
  const rows = await Escrow.getConfig();
  const cfg = {};
  for (const row of rows) {
    cfg[row.key] = row.is_encrypted ? (decrypt(row.value) ?? '') : (row.value ?? '');
  }
  return cfg;
}

/**
 * Save multiple config key/value pairs.
 * Keys listed in ENCRYPTED_KEYS will be AES-256 encrypted before storage.
 * @param {Record<string, string>} updates - { key: value, … }
 * @param {string} actorId
 */
export async function saveEscrowConfig(updates, actorId) {
  const ENCRYPTED_KEYS = new Set(['stripe_secret_key', 'paypal_client_secret']);
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    const isEncrypted = ENCRYPTED_KEYS.has(key);
    const stored = isEncrypted ? encrypt(String(value)) : String(value);
    results.push(await Escrow.setConfig(key, stored, actorId, isEncrypted));
  }
  return results;
}

// ─── Fund operations ──────────────────────────────────────────────────────────

/**
 * Create an escrow record and immediately hold funds.
 * @param {object} params - { order_id, buyer_id, supplier_id, amount, currency }
 * @param {string} actorId
 * @returns {Promise<object>}
 */
export async function createAndHold(params, actorId) {
  const cfg = await getEscrowConfig();

  if (cfg.escrow_enabled !== 'true') {
    throw Object.assign(new Error('Escrow system is currently disabled.'), { statusCode: 503 });
  }

  const minAmount = parseFloat(cfg.min_escrow_amount || '0');
  if (parseFloat(params.amount) < minAmount) {
    throw Object.assign(
      new Error(`Minimum escrow amount is ${minAmount} ${params.currency || 'USD'}.`),
      { statusCode: 422 },
    );
  }

  return Escrow.createEscrow(params, actorId);
}

/**
 * Release escrow funds to the supplier.
 * Only allowed when status === 'held'.
 * @param {string} escrowId
 * @param {string} actorId
 * @returns {Promise<object>}
 */
export async function releaseFunds(escrowId, actorId) {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw Object.assign(new Error('Escrow not found.'), { statusCode: 404 });
  if (escrow.status !== 'held') {
    throw Object.assign(new Error(`Cannot release funds: current status is '${escrow.status}'.`), { statusCode: 422 });
  }
  return Escrow.releaseFunds(escrowId, actorId);
}

/**
 * Refund escrow funds to the buyer.
 * Only allowed when status === 'held' or 'disputed'.
 * @param {string} escrowId
 * @param {string} actorId
 * @param {string} [reason]
 * @returns {Promise<object>}
 */
export async function refundFunds(escrowId, actorId, reason) {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw Object.assign(new Error('Escrow not found.'), { statusCode: 404 });
  if (!['held', 'disputed'].includes(escrow.status)) {
    throw Object.assign(new Error(`Cannot refund: current status is '${escrow.status}'.`), { statusCode: 422 });
  }
  return Escrow.refundFunds(escrowId, actorId, reason);
}

// ─── Milestones ───────────────────────────────────────────────────────────────

/**
 * Add a milestone to an existing escrow.
 * @param {string} escrowId
 * @param {object} data - { name, amount, due_date? }
 * @param {string} actorId
 * @returns {Promise<object>}
 */
export async function addMilestone(escrowId, data, actorId) {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw Object.assign(new Error('Escrow not found.'), { statusCode: 404 });
  return Escrow.addMilestone(escrowId, data, actorId);
}

/**
 * Mark a milestone complete. If ALL milestones are now complete, auto-release funds.
 * @param {string} escrowId
 * @param {string} milestoneId
 * @param {string} actorId
 * @returns {Promise<{ milestone: object, escrow: object|null }>}
 */
export async function completeMilestone(escrowId, milestoneId, actorId) {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw Object.assign(new Error('Escrow not found.'), { statusCode: 404 });

  const milestone = await Escrow.completeMilestone(escrowId, milestoneId, actorId);

  // Check if all milestones are complete → auto-release
  const milestones = await Escrow.getMilestones(escrowId);
  const allDone = milestones.length > 0 && milestones.every((m) => m.status === 'completed' || m.status === 'released');
  let updatedEscrow = null;
  if (allDone && escrow.status === 'held') {
    updatedEscrow = await Escrow.releaseFunds(escrowId, actorId);
  }

  return { milestone, escrow: updatedEscrow };
}

// ─── Auto-release timer ───────────────────────────────────────────────────────

/**
 * Check for escrow transactions past their auto-release date and release them.
 * Called once at startup and then every hour.
 */
export async function runAutoRelease() {
  try {
    const cfg = await getEscrowConfig();
    if (cfg.auto_release_enabled !== 'true') return;

    const days = parseInt(cfg.auto_release_days || '14', 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result = await Escrow.db
      .from('escrow_transactions')
      .select('id')
      .eq('status', 'held')
      .lt('held_at', cutoff);

    if (result.error) return;
    const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';
    for (const row of result.data || []) {
      try {
        await Escrow.releaseFunds(row.id, SYSTEM_ACTOR);
      } catch {
        // individual failure should not block others
      }
    }
  } catch {
    // swallow — background job should never crash the server
  }
}

// Schedule auto-release to run on startup and then every hour
runAutoRelease();
setInterval(runAutoRelease, 60 * 60 * 1000);

// ─── Payment gateway test connection ─────────────────────────────────────────

/**
 * Verify that the configured payment gateway credentials are valid.
 * Returns { success, message }.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testGatewayConnection() {
  const cfg = await getEscrowConfig();
  const gateway = cfg.payment_gateway || 'stripe';
  const mode = cfg.gateway_mode || 'test';

  if (gateway === 'stripe') {
    const secretKey = cfg.stripe_secret_key;
    if (!secretKey) {
      return { success: false, message: 'Stripe secret key is not configured.' };
    }
    try {
      // Lightweight Stripe API call — retrieve account info
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (response.ok) {
        return { success: true, message: `Stripe (${mode} mode) connection successful.` };
      }
      const body = await response.json();
      return { success: false, message: body?.error?.message || 'Stripe authentication failed.' };
    } catch (err) {
      return { success: false, message: `Network error: ${err.message}` };
    }
  }

  if (gateway === 'paypal') {
    const clientId = cfg.paypal_client_id;
    const clientSecret = cfg.paypal_client_secret;
    if (!clientId || !clientSecret) {
      return { success: false, message: 'PayPal credentials are not fully configured.' };
    }
    try {
      const baseUrl = mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (response.ok) {
        return { success: true, message: `PayPal (${mode} mode) connection successful.` };
      }
      const body = await response.json();
      return { success: false, message: body?.error_description || 'PayPal authentication failed.' };
    } catch (err) {
      return { success: false, message: `Network error: ${err.message}` };
    }
  }

  return { success: false, message: `Unknown gateway: ${gateway}` };
}
