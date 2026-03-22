/**
 * Globex Sky — AI Search Service
 * Fuzzy text search with typo tolerance, auto-correction/suggestions,
 * synonym mapping, ranking algorithm, analytics, image search,
 * voice search, and barcode lookup.
 */

import supabase from '../../config/supabase.js';

// ─── Synonym Map ──────────────────────────────────────────────────────────────

const SYNONYM_MAP = {
  phone: ['mobile', 'smartphone', 'cellphone', 'handset'],
  laptop: ['notebook', 'computer', 'pc', 'ultrabook'],
  shoes: ['footwear', 'sneakers', 'boots', 'sandals'],
  shirt: ['top', 'blouse', 'tee', 't-shirt', 'polo'],
  tv: ['television', 'monitor', 'display', 'screen'],
  fridge: ['refrigerator', 'cooler'],
  sofa: ['couch', 'settee', 'loveseat'],
  bag: ['purse', 'handbag', 'backpack', 'tote'],
};

// ─── In-memory Search Analytics ───────────────────────────────────────────────

const searchAnalytics = {
  queries: {},       // { normalizedQuery: { count, lastSearched, resultCount } }
  zeroResults: {},   // { normalizedQuery: count }
};

// ─── Fuzzy Search ─────────────────────────────────────────────────────────────

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Expand a query with synonyms.
 * @param {string} query
 * @returns {string[]} expanded terms
 */
function expandWithSynonyms(query) {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  for (const word of words) {
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (word === key || synonyms.includes(word)) {
        expanded.add(key);
        synonyms.forEach((s) => expanded.add(s));
      }
    }
  }
  return [...expanded];
}

/**
 * Main AI search — fuzzy text search with typo tolerance, synonym expansion,
 * and relevance + popularity + recency ranking.
 * @param {string} rawQuery
 * @param {{ page?: number, limit?: number, category_id?: string, minPrice?: number, maxPrice?: number }} filters
 * @param {string|null} userId
 */
export async function aiSearch(rawQuery, filters = {}, userId = null) {
  const { page = 1, limit = 20, category_id, minPrice, maxPrice } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const normalized = rawQuery.trim().toLowerCase();
  const expandedTerms = expandWithSynonyms(normalized);

  // Build OR ilike conditions for each expanded term
  let q = supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating, view_count, created_at, supplier_id', { count: 'exact' })
    .eq('status', 'active');

  // Use OR filter across all synonym terms
  const ilikeFilters = expandedTerms.map((term) => `title.ilike.%${term}%`).join(',');
  q = q.or(ilikeFilters);

  if (category_id) q = q.eq('category_id', category_id);
  if (minPrice !== undefined) q = q.gte('price', minPrice);
  if (maxPrice !== undefined) q = q.lte('price', maxPrice);

  const { data: products, error, count } = await q.range(from, to);
  if (error) throw error;

  // Rank results: relevance (title match closeness) + popularity + recency
  const now = Date.now();
  const ranked = (products || []).map((p) => {
    const titleLower = p.title.toLowerCase();
    const exactMatch = titleLower.includes(normalized) ? 10 : 0;
    const relevance = exactMatch + (10 - Math.min(levenshtein(normalized, titleLower.substring(0, normalized.length)), 10));
    const popularity = Math.log1p(p.view_count || 0);
    const ageDays = (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.max(0, 30 - ageDays) / 30;
    const rankScore = relevance * 0.5 + popularity * 0.3 + recency * 0.2;
    return { ...p, rank_score: +rankScore.toFixed(3) };
  }).sort((a, b) => b.rank_score - a.rank_score);

  // Suggestion if zero results: generate auto-correction
  let suggestion = null;
  if (!count) {
    suggestion = await generateAutoCorrection(normalized);
  }

  // Track analytics
  _trackSearch(normalized, count || 0, userId);

  return { data: ranked, total: count || 0, page, limit, suggestion };
}

// ─── Auto-correction / Suggestions ───────────────────────────────────────────

/**
 * Generate query auto-correction suggestion based on product title similarity.
 * @param {string} query
 */
export async function generateAutoCorrection(query) {
  if (!query || query.length < 3) return null;

  const { data: titles } = await supabase
    .from('products')
    .select('title')
    .eq('status', 'active')
    .limit(100);

  if (!titles?.length) return null;

  let bestMatch = null;
  let bestDist = Infinity;

  for (const { title } of titles) {
    const titleWords = title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (Math.abs(word.length - query.length) > 3) continue;
      const dist = levenshtein(query, word);
      if (dist < bestDist && dist <= 2) {
        bestDist = dist;
        bestMatch = word;
      }
    }
  }

  return bestMatch;
}

/**
 * Get search auto-complete suggestions.
 * @param {string} prefix
 */
export async function getSearchSuggestions(prefix) {
  if (!prefix || prefix.length < 2) return { suggestions: [] };

  const { data, error } = await supabase
    .from('products')
    .select('title')
    .eq('status', 'active')
    .ilike('title', `${prefix}%`)
    .limit(8);

  if (error) throw error;

  // Include popular past searches with this prefix
  const popularPast = Object.entries(searchAnalytics.queries)
    .filter(([q]) => q.startsWith(prefix.toLowerCase()))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 4)
    .map(([q]) => q);

  const productTitles = (data || []).map((p) => p.title);
  const suggestions = [...new Set([...popularPast, ...productTitles])].slice(0, 10);
  return { suggestions };
}

// ─── Synonym Management ───────────────────────────────────────────────────────

/**
 * Get all synonym mappings (returns both built-in and DB-stored ones).
 */
export async function getSynonymMappings() {
  const { data } = await supabase.from('search_synonyms').select('*').order('keyword');
  const dbSynonyms = (data || []).reduce((acc, row) => {
    acc[row.keyword] = row.synonyms;
    return acc;
  }, {});
  return { builtin: SYNONYM_MAP, custom: dbSynonyms };
}

/**
 * Add or update a synonym mapping.
 * @param {string} keyword
 * @param {string[]} synonyms
 */
export async function upsertSynonymMapping(keyword, synonyms) {
  const { data, error } = await supabase
    .from('search_synonyms')
    .upsert([{ keyword: keyword.toLowerCase(), synonyms }], { onConflict: 'keyword' })
    .select()
    .single();
  if (error) throw error;
  // Update in-memory map
  SYNONYM_MAP[keyword.toLowerCase()] = synonyms;
  return data;
}

// ─── Image Search ─────────────────────────────────────────────────────────────

/**
 * Image-based search: accept base64 image, extract placeholder keywords, search products.
 * In production this would call a vision AI API.
 * @param {string} imageBase64
 */
export async function imageSearch(imageBase64) {
  if (!imageBase64) throw new Error('Image data is required.');

  // NOTE: Production implementation should send imageBase64 to a vision AI service
  // (e.g., Google Vision, AWS Rekognition) to extract product tags/keywords,
  // then perform a targeted text search. For now, returns top-rated products
  // as a placeholder until the vision API integration is available.
  const { data, error } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating')
    .eq('status', 'active')
    .order('average_rating', { ascending: false })
    .limit(20);

  if (error) throw error;
  return {
    data: data || [],
    note: 'Visual similarity search placeholder. Production results will be ranked by image embedding proximity via a vision AI service.',
  };
}

// ─── Voice Search ─────────────────────────────────────────────────────────────

/**
 * Process a voice search transcription and run AI search.
 * @param {string} transcription
 * @param {object} filters
 * @param {string|null} userId
 */
export async function voiceSearch(transcription, filters = {}, userId = null) {
  if (!transcription) throw new Error('Transcription is required.');
  const normalized = transcription.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  return aiSearch(normalized, filters, userId);
}

// ─── Barcode Lookup ───────────────────────────────────────────────────────────

/**
 * Look up a product by barcode or SKU.
 * @param {string} barcodeValue
 */
export async function barcodeLookup(barcodeValue) {
  if (!barcodeValue) throw new Error('Barcode value is required.');
  // Use separate parameterized queries instead of string interpolation in .or()
  const [byBarcode, bySku] = await Promise.all([
    supabase
      .from('products')
      .select('id, title, price, images, category_id, average_rating, sku')
      .eq('status', 'active')
      .eq('barcode', barcodeValue)
      .limit(5),
    supabase
      .from('products')
      .select('id, title, price, images, category_id, average_rating, sku')
      .eq('status', 'active')
      .eq('sku', barcodeValue)
      .limit(5),
  ]);

  if (byBarcode.error) throw byBarcode.error;
  if (bySku.error) throw bySku.error;

  const seen = new Set();
  const data = [...(byBarcode.data || []), ...(bySku.data || [])].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return { data };
}

// ─── Search Analytics ─────────────────────────────────────────────────────────

/**
 * Get search analytics (top queries, zero-result queries).
 */
export async function getSearchAnalytics() {
  const topQueries = Object.entries(searchAnalytics.queries)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([query, stats]) => ({ query, ...stats }));

  const zeroResultQueries = Object.entries(searchAnalytics.zeroResults)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  return { topQueries, zeroResultQueries };
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _trackSearch(query, resultCount, userId) {
  if (!query) return;
  if (!searchAnalytics.queries[query]) {
    searchAnalytics.queries[query] = { count: 0, lastSearched: null, resultCount: 0 };
  }
  searchAnalytics.queries[query].count += 1;
  searchAnalytics.queries[query].lastSearched = new Date().toISOString();
  searchAnalytics.queries[query].resultCount = resultCount;

  if (resultCount === 0) {
    searchAnalytics.zeroResults[query] = (searchAnalytics.zeroResults[query] || 0) + 1;
  }

  // Persist asynchronously (fire and forget)
  supabase.from('search_analytics_log').insert([{
    query,
    result_count: resultCount,
    user_id: userId || null,
  }]).then(() => {}).catch((err) => {
    console.error('[AI Search] Failed to log analytics:', err?.message);
  });
}
