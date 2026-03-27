import BaseModel from './BaseModel.js';
import supabase from '../config/supabase.js';

/**
 * RFQMatch model
 *
 * Table: rfq_matches
 * Fields: id, rfq_id, supplier_id, match_score, match_reasons, status,
 *         notified_at, viewed_at, quoted_at, created_at
 */
export default class RFQMatch extends BaseModel {
  static get tableName() {
    return 'rfq_matches';
  }

  /**
   * Run weighted/AI/hybrid supplier matching for an RFQ.
   * Returns the list of supplier matches (sorted by score).
   *
   * @param {string} rfqId
   * @param {object} config - key/value config from rfq_match_config table
   * @returns {Promise<object[]>} inserted/upserted match rows
   */
  static async matchSuppliers(rfqId, config = {}) {
    // Fetch RFQ details
    const { data: rfq, error: rfqErr } = await supabase
      .from('rfqs')
      .select('*')
      .eq('id', rfqId)
      .single();
    if (rfqErr || !rfq) throw new Error('RFQ not found');

    // Fetch active suppliers with profile data
    const { data: suppliers, error: supErr } = await supabase
      .from('supplier_profiles')
      .select('id, user_id, company_name, country, categories, rating, response_rate, on_time_delivery_rate, min_order_value, max_order_value')
      .eq('is_active', true);
    if (supErr) throw supErr;

    const weights = {
      category:      parseFloat(config.weight_category_match  ?? 0.30),
      country:       parseFloat(config.weight_country_match   ?? 0.15),
      price:         parseFloat(config.weight_price_range     ?? 0.20),
      rating:        parseFloat(config.weight_rating          ?? 0.15),
      responseRate:  parseFloat(config.weight_response_rate   ?? 0.10),
      onTimeDelivery:parseFloat(config.weight_on_time_delivery ?? 0.10),
    };
    const minScore   = parseFloat(config.min_match_score    ?? 0.5);
    const maxMatches = parseInt(config.max_matches_per_rfq  ?? 20, 10);

    const scored = suppliers
      .map((s) => {
        const reasons = [];
        let score = 0;

        // Category match
        const supplierCats = Array.isArray(s.categories) ? s.categories : [];
        if (rfq.category_id && supplierCats.includes(rfq.category_id)) {
          score += weights.category;
          reasons.push({ factor: 'category_match', contribution: weights.category, detail: 'Category matched' });
        }

        // Country match (buyer preferred country stored in rfq.destination_country)
        if (rfq.destination_country && s.country === rfq.destination_country) {
          score += weights.country;
          reasons.push({ factor: 'country_match', contribution: weights.country, detail: `Country: ${s.country}` });
        }

        // Price range alignment
        const targetPrice = parseFloat(rfq.target_price ?? 0);
        if (targetPrice > 0) {
          const minOV = parseFloat(s.min_order_value ?? 0);
          const maxOV = parseFloat(s.max_order_value ?? Infinity);
          if (targetPrice >= minOV && (maxOV === Infinity || targetPrice <= maxOV)) {
            score += weights.price;
            reasons.push({ factor: 'price_range', contribution: weights.price, detail: 'Price within supplier range' });
          }
        } else {
          // No target price info — give partial credit
          score += weights.price * 0.5;
          reasons.push({ factor: 'price_range', contribution: weights.price * 0.5, detail: 'No target price specified' });
        }

        // Rating (0–5 normalised to 0–1)
        const ratingScore = (parseFloat(s.rating ?? 0) / 5) * weights.rating;
        score += ratingScore;
        if (ratingScore > 0) {
          reasons.push({ factor: 'rating', contribution: ratingScore, detail: `Rating: ${s.rating}/5` });
        }

        // Response rate (0–100 normalised)
        const rrScore = (parseFloat(s.response_rate ?? 0) / 100) * weights.responseRate;
        score += rrScore;
        if (rrScore > 0) {
          reasons.push({ factor: 'response_rate', contribution: rrScore, detail: `Response rate: ${s.response_rate}%` });
        }

        // On-time delivery rate (0–100 normalised)
        const otdScore = (parseFloat(s.on_time_delivery_rate ?? 0) / 100) * weights.onTimeDelivery;
        score += otdScore;
        if (otdScore > 0) {
          reasons.push({ factor: 'on_time_delivery', contribution: otdScore, detail: `On-time delivery: ${s.on_time_delivery_rate}%` });
        }

        return { supplier_id: s.id, match_score: Math.min(1, score), match_reasons: reasons };
      })
      .filter((m) => m.match_score >= minScore)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, maxMatches);

    if (scored.length === 0) return [];

    // Upsert matches
    const rows = scored.map((m) => ({
      rfq_id: rfqId,
      supplier_id: m.supplier_id,
      match_score: m.match_score,
      match_reasons: m.match_reasons,
      status: 'pending',
    }));

    const { data, error } = await supabase
      .from('rfq_matches')
      .upsert(rows, { onConflict: 'rfq_id,supplier_id' })
      .select();
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Get all matches for a given RFQ.
   * @param {string} rfqId
   * @param {object} [options]
   * @returns {Promise<object[]>}
   */
  static async getMatches(rfqId, options = {}) {
    const page  = parseInt(options.page  ?? 1, 10);
    const limit = parseInt(options.limit ?? 20, 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    const { data, error, count } = await supabase
      .from('rfq_matches')
      .select('*, supplier:supplier_profiles(id, company_name, country, rating, logo_url)', { count: 'exact' })
      .eq('rfq_id', rfqId)
      .order('match_score', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Notify matched suppliers (set status = 'notified', record timestamp).
   * @param {string} rfqId
   * @returns {Promise<number>} count of notified rows
   */
  static async notifySuppliers(rfqId) {
    const { data, error } = await supabase
      .from('rfq_matches')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('rfq_id', rfqId)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    return (data ?? []).length;
  }

  /**
   * Get all marketplace RFQs (public listings).
   * @param {object} [filters]
   * @param {object} [options]
   */
  static async getMarketplaceRFQs(filters = {}, options = {}) {
    const page  = parseInt(options.page  ?? 1, 10);
    const limit = parseInt(options.limit ?? 20, 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    let query = supabase
      .from('rfq_marketplace')
      .select('*, rfq:rfqs(id, product_name, description, quantity, unit, target_price, currency, category_id, created_at)', { count: 'exact' })
      .eq('is_public', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.category_id) query = query.eq('category_id', filters.category_id);
    if (filters.urgency)     query = query.eq('urgency', filters.urgency);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Publish an RFQ to the marketplace.
   * @param {string} rfqId
   * @param {object} payload
   */
  static async publishToMarketplace(rfqId, payload = {}) {
    const { data, error } = await supabase
      .from('rfq_marketplace')
      .upsert([{
        rfq_id:       rfqId,
        is_public:    payload.is_public    ?? true,
        category_id:  payload.category_id  ?? null,
        tags:         payload.tags         ?? [],
        budget_range: payload.budget_range ?? null,
        urgency:      payload.urgency      ?? 'medium',
        expires_at:   payload.expires_at   ?? null,
      }], { onConflict: 'rfq_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
