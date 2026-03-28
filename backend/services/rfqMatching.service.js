/**
 * RFQ Matching Service
 *
 * Weighted scoring algorithm, AI-powered matching (OpenAI), hybrid matching,
 * auto-notification, and marketplace listing management.
 */

import { createHash } from 'crypto';
import supabase from '../config/supabase.js';

// ─── Config Helpers ──────────────────────────────────────────────────────────

/**
 * Load all rfq_match_config rows into a flat { key: value } map.
 * @returns {Promise<Record<string, string>>}
 */
export async function loadConfig() {
  const { data, error } = await supabase
    .from('rfq_match_config')
    .select('key, value, is_encrypted');
  if (error) throw error;

  const cfg = {};
  for (const row of data ?? []) {
    cfg[row.key] = row.value;
  }
  return cfg;
}

/**
 * Update one or more config keys.
 * @param {Record<string, string>} updates — key→value pairs
 * @param {string} [userId] — who made the change
 */
export async function updateConfig(updates, userId) {
  const now = new Date().toISOString();
  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: now,
    updated_by: userId ?? null,
  }));

  for (const row of rows) {
    const { error } = await supabase
      .from('rfq_match_config')
      .update({ value: row.value, updated_at: row.updated_at, updated_by: row.updated_by })
      .eq('key', row.key);
    if (error) throw error;
  }

  return loadConfig();
}

// ─── Weighted Scoring ────────────────────────────────────────────────────────

/**
 * Calculate a weighted match score for a single supplier against an RFQ.
 * @param {object} rfq
 * @param {object} supplier
 * @param {object} weights — { category, country, price, rating, responseRate, onTimeDelivery }
 * @returns {{ score: number, reasons: object[] }}
 */
export function calculateWeightedScore(rfq, supplier, weights) {
  const reasons = [];
  let score = 0;

  // Category match
  const supplierCats = Array.isArray(supplier.categories) ? supplier.categories : [];
  if (rfq.category_id && supplierCats.includes(rfq.category_id)) {
    score += weights.category;
    reasons.push({ factor: 'category_match', contribution: weights.category, detail: 'Category matched' });
  }

  // Country match
  if (rfq.destination_country && supplier.country === rfq.destination_country) {
    score += weights.country;
    reasons.push({ factor: 'country_match', contribution: weights.country, detail: `Country: ${supplier.country}` });
  }

  // Price range alignment
  const targetPrice = parseFloat(rfq.target_price ?? 0);
  if (targetPrice > 0) {
    const minOV = parseFloat(supplier.min_order_value ?? 0);
    const maxOV = parseFloat(supplier.max_order_value ?? Infinity);
    if (targetPrice >= minOV && (maxOV === Infinity || targetPrice <= maxOV)) {
      score += weights.price;
      reasons.push({ factor: 'price_range', contribution: weights.price, detail: 'Price within supplier range' });
    }
  } else {
    score += weights.price * 0.5;
    reasons.push({ factor: 'price_range', contribution: weights.price * 0.5, detail: 'No target price specified' });
  }

  // Rating (0-5 normalised)
  const ratingScore = (parseFloat(supplier.rating ?? 0) / 5) * weights.rating;
  score += ratingScore;
  if (ratingScore > 0) {
    reasons.push({ factor: 'rating', contribution: ratingScore, detail: `Rating: ${supplier.rating}/5` });
  }

  // Response rate (0-100 normalised)
  const rrScore = (parseFloat(supplier.response_rate ?? 0) / 100) * weights.responseRate;
  score += rrScore;
  if (rrScore > 0) {
    reasons.push({ factor: 'response_rate', contribution: rrScore, detail: `Response rate: ${supplier.response_rate}%` });
  }

  // On-time delivery (0-100 normalised)
  const otdScore = (parseFloat(supplier.on_time_delivery_rate ?? 0) / 100) * weights.onTimeDelivery;
  score += otdScore;
  if (otdScore > 0) {
    reasons.push({ factor: 'on_time_delivery', contribution: otdScore, detail: `On-time delivery: ${supplier.on_time_delivery_rate}%` });
  }

  return { score: Math.min(1, score), reasons };
}

// ─── AI-Powered Matching ─────────────────────────────────────────────────────

/**
 * Call OpenAI (or compatible provider) to analyse and score suppliers for an RFQ.
 * Falls back to weighted scoring when AI is unavailable.
 *
 * @param {object} rfq
 * @param {object[]} suppliers — top candidates from weighted scoring
 * @param {object} config
 * @returns {Promise<object[]>} — [ { supplier_id, score, reasons } ]
 */
export async function aiPoweredMatch(rfq, suppliers, config) {
  const apiKey = config.ai_api_key;
  if (!apiKey) {
    // No API key configured — return suppliers as-is with a note
    return suppliers.map((s) => ({
      supplier_id: s.id,
      score: 0.5,
      reasons: [{ factor: 'ai_fallback', contribution: 0.5, detail: 'AI matching unavailable — no API key configured' }],
    }));
  }

  try {
    const prompt = buildAIPrompt(rfq, suppliers);
    const response = await callAIProvider(config.ai_provider || 'openai', apiKey, prompt);
    return parseAIResponse(response, suppliers);
  } catch (err) {
    // Graceful fallback
    return suppliers.map((s) => ({
      supplier_id: s.id,
      score: 0.5,
      reasons: [{ factor: 'ai_error', contribution: 0.5, detail: `AI matching error: ${err.message}` }],
    }));
  }
}

/**
 * Build prompt for AI analysis.
 */
function buildAIPrompt(rfq, suppliers) {
  const supplierInfo = suppliers.map((s) => ({
    id: s.id,
    company: s.company_name,
    country: s.country,
    rating: s.rating,
    categories: s.categories,
    response_rate: s.response_rate,
    on_time_delivery: s.on_time_delivery_rate,
  }));

  return `Analyse these suppliers for the following RFQ and return a JSON array of { supplier_id, score (0-1), reasoning }.

RFQ:
- Product: ${rfq.product_name || rfq.title || 'N/A'}
- Description: ${rfq.description || 'N/A'}
- Category ID: ${rfq.category_id || 'N/A'}
- Quantity: ${rfq.quantity || 'N/A'} ${rfq.unit || ''}
- Target Price: ${rfq.target_price || 'N/A'} ${rfq.currency || 'USD'}
- Destination: ${rfq.destination_country || 'N/A'}

Suppliers:
${JSON.stringify(supplierInfo, null, 2)}

Return ONLY a valid JSON array, no other text.`;
}

/**
 * Call the AI provider API.
 */
async function callAIProvider(provider, apiKey, prompt) {
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert B2B supplier matching assistant. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '[]';
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

/**
 * Parse AI response into normalised match results.
 */
function parseAIResponse(raw, suppliers) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item.supplier_id && typeof item.score === 'number')
      .map((item) => ({
        supplier_id: item.supplier_id,
        score: Math.max(0, Math.min(1, item.score)),
        reasons: [{ factor: 'ai_analysis', contribution: item.score, detail: item.reasoning || 'AI matched' }],
      }));
  } catch {
    return suppliers.map((s) => ({
      supplier_id: s.id,
      score: 0.5,
      reasons: [{ factor: 'ai_parse_error', contribution: 0.5, detail: 'Could not parse AI response' }],
    }));
  }
}

// ─── Hybrid Matching ─────────────────────────────────────────────────────────

/**
 * Hybrid matching: weighted scoring first, then AI refinement on top candidates.
 */
export async function hybridMatch(rfq, suppliers, weights, config) {
  // Step 1 — weighted scoring for all suppliers
  const weighted = suppliers.map((s) => {
    const { score, reasons } = calculateWeightedScore(rfq, s, weights);
    return { ...s, weightedScore: score, weightedReasons: reasons };
  });

  // Take top 2× candidates for AI refinement
  const topCandidates = weighted
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 40);

  // Step 2 — AI refinement
  const aiResults = await aiPoweredMatch(rfq, topCandidates, config);

  // Step 3 — merge scores (70% weighted + 30% AI)
  return topCandidates.map((s) => {
    const ai = aiResults.find((a) => a.supplier_id === s.id);
    const aiScore = ai?.score ?? s.weightedScore;
    const combined = s.weightedScore * 0.7 + aiScore * 0.3;
    const allReasons = [
      ...s.weightedReasons,
      ...(ai?.reasons ?? []),
    ];
    return { supplier_id: s.id, score: Math.min(1, combined), reasons: allReasons };
  });
}

// ─── Main Matching Orchestrator ──────────────────────────────────────────────

/**
 * Run the full matching pipeline for an RFQ.
 * Reads config, selects algorithm, scores suppliers, persists results.
 *
 * @param {string} rfqId
 * @returns {Promise<object[]>} — persisted match rows
 */
export async function runMatching(rfqId) {
  const config = await loadConfig();

  // Feature gate
  if (config.feature_enabled !== 'true') {
    throw new Error('RFQ auto-matching is currently disabled.');
  }

  // Fetch RFQ
  const { data: rfq, error: rfqErr } = await supabase
    .from('rfqs')
    .select('*')
    .eq('id', rfqId)
    .single();
  if (rfqErr || !rfq) throw new Error('RFQ not found');

  // Fetch active suppliers
  const { data: suppliers, error: supErr } = await supabase
    .from('supplier_profiles')
    .select('id, user_id, company_name, country, categories, rating, response_rate, on_time_delivery_rate, min_order_value, max_order_value')
    .eq('is_active', true);
  if (supErr) throw supErr;

  if (!suppliers || suppliers.length === 0) return [];

  const weights = {
    category:      parseFloat(config.weight_category_match   ?? 0.30),
    country:       parseFloat(config.weight_country_match    ?? 0.15),
    price:         parseFloat(config.weight_price_range      ?? 0.20),
    rating:        parseFloat(config.weight_rating           ?? 0.15),
    responseRate:  parseFloat(config.weight_response_rate    ?? 0.10),
    onTimeDelivery:parseFloat(config.weight_on_time_delivery ?? 0.10),
  };
  const minScore   = parseFloat(config.min_match_score   ?? 0.5);
  const maxMatches = parseInt(config.max_matches_per_rfq ?? 20, 10);
  const algorithm  = config.matching_algorithm ?? 'weighted';

  let results;

  if (algorithm === 'ai_powered') {
    const aiResults = await aiPoweredMatch(rfq, suppliers, config);
    results = aiResults;
  } else if (algorithm === 'hybrid') {
    results = await hybridMatch(rfq, suppliers, weights, config);
  } else {
    // Default: weighted
    results = suppliers.map((s) => {
      const { score, reasons } = calculateWeightedScore(rfq, s, weights);
      return { supplier_id: s.id, score, reasons };
    });
  }

  // Filter and sort
  const finalMatches = results
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMatches);

  if (finalMatches.length === 0) return [];

  // Persist
  const rows = finalMatches.map((m) => ({
    rfq_id:        rfqId,
    supplier_id:   m.supplier_id,
    match_score:   m.score,
    match_reasons: m.reasons,
    status:        'pending',
  }));

  const { data, error } = await supabase
    .from('rfq_matches')
    .upsert(rows, { onConflict: 'rfq_id,supplier_id' })
    .select();
  if (error) throw error;

  // Auto-notify if enabled
  if (config.auto_notify_suppliers === 'true') {
    await notifyMatchedSuppliers(rfqId);
  }

  return data ?? [];
}

// ─── Notification ────────────────────────────────────────────────────────────

/**
 * Mark pending matches as notified and record timestamp.
 */
export async function notifyMatchedSuppliers(rfqId) {
  const { data, error } = await supabase
    .from('rfq_matches')
    .update({ status: 'notified', notified_at: new Date().toISOString() })
    .eq('rfq_id', rfqId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

/**
 * Publish an RFQ to the public marketplace.
 */
export async function publishToMarketplace(rfqId, payload = {}, config = null) {
  const cfg = config ?? await loadConfig();
  const expiryDays = parseInt(cfg.rfq_expiry_days ?? 30, 10);
  const expiresAt = payload.expires_at ?? new Date(Date.now() + expiryDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from('rfq_marketplace')
    .upsert([{
      rfq_id:       rfqId,
      is_public:    payload.is_public    ?? true,
      category_id:  payload.category_id  ?? null,
      tags:         payload.tags         ?? [],
      budget_range: payload.budget_range ?? null,
      urgency:      payload.urgency      ?? 'medium',
      expires_at:   expiresAt,
    }], { onConflict: 'rfq_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Test Matching ───────────────────────────────────────────────────────────

/**
 * Run a test match with sample data (does NOT persist results).
 * Used from the admin panel "Test Matching" button.
 */
export async function testMatching(config) {
  const sampleRfq = {
    id: '00000000-0000-0000-0000-000000000001',
    product_name: 'Test Product',
    description: 'Sample RFQ for testing matching algorithms',
    category_id: null,
    quantity: 100,
    unit: 'pcs',
    target_price: 50,
    currency: 'USD',
    destination_country: 'US',
  };

  const sampleSuppliers = [
    { id: 's1', company_name: 'Supplier A', country: 'US', categories: [], rating: 4.5, response_rate: 95, on_time_delivery_rate: 90, min_order_value: 0, max_order_value: 10000 },
    { id: 's2', company_name: 'Supplier B', country: 'CN', categories: [], rating: 4.0, response_rate: 80, on_time_delivery_rate: 85, min_order_value: 10, max_order_value: 5000 },
    { id: 's3', company_name: 'Supplier C', country: 'US', categories: [], rating: 3.5, response_rate: 70, on_time_delivery_rate: 75, min_order_value: 0, max_order_value: 2000 },
  ];

  const weights = {
    category:       parseFloat(config.weight_category_match   ?? 0.30),
    country:        parseFloat(config.weight_country_match    ?? 0.15),
    price:          parseFloat(config.weight_price_range      ?? 0.20),
    rating:         parseFloat(config.weight_rating           ?? 0.15),
    responseRate:   parseFloat(config.weight_response_rate    ?? 0.10),
    onTimeDelivery: parseFloat(config.weight_on_time_delivery ?? 0.10),
  };

  const algorithm = config.matching_algorithm ?? 'weighted';
  let results;

  if (algorithm === 'ai_powered') {
    results = await aiPoweredMatch(sampleRfq, sampleSuppliers, config);
  } else if (algorithm === 'hybrid') {
    results = await hybridMatch(sampleRfq, sampleSuppliers, weights, config);
  } else {
    results = sampleSuppliers.map((s) => {
      const { score, reasons } = calculateWeightedScore(sampleRfq, s, weights);
      return { supplier_id: s.id, supplier_name: s.company_name, score, reasons };
    });
  }

  return {
    algorithm,
    rfq: sampleRfq,
    matches: results.sort((a, b) => b.score - a.score),
    timestamp: new Date().toISOString(),
  };
}
