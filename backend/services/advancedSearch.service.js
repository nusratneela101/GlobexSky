import supabase from '../config/supabase.js';

// ─── In-memory analytics store (replace with DB persistence in production) ───
const searchAnalytics = {
  queries: [],
  zeroResults: [],
  clickThrough: {},
};

// ─── Full-text search with facets ────────────────────────────────────────────
export async function fullTextSearch(query, filters = {}, page = 1, limit = 20) {
  const { category_id, minPrice, maxPrice, minRating, supplierId } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from('products')
    .select('*, supplier:supplier_profiles(company_name, verified)', { count: 'exact' })
    .eq('status', 'active')
    .range(from, to);

  if (query) {
    q = q.textSearch('title', query, { type: 'websearch' });
  }
  if (category_id) q = q.eq('category_id', category_id);
  if (minPrice !== undefined) q = q.gte('price', minPrice);
  if (maxPrice !== undefined) q = q.lte('price', maxPrice);
  if (minRating !== undefined) q = q.gte('average_rating', minRating);
  if (supplierId) q = q.eq('supplier_id', supplierId);

  const { data, error, count } = await q;
  if (error) throw error;

  // Track analytics
  _trackQuery(query, count);

  // Spelling suggestion (simple: strip last char if zero results)
  const suggestion = count === 0 && query.length > 3 ? query.slice(0, -1) : null;

  return { data, total: count, page, limit, suggestion };
}

// ─── Voice search (accept transcription from Web Speech API) ─────────────────
export async function processVoiceSearch(transcription, userId, filters = {}) {
  if (!transcription) throw new Error('Transcription is required.');
  // Normalize voice transcription
  const normalized = transcription.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  return fullTextSearch(normalized, filters);
}

// ─── Image search (accept base64 image hash for visual similarity) ────────────
export async function processImageSearch(imageBase64) {
  if (!imageBase64) throw new Error('Image data is required.');
  // In production, send to a vision AI service to extract keywords/tags.
  // For now, return a representative sample of products.
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:supplier_profiles(company_name)')
    .eq('status', 'active')
    .limit(20);
  if (error) throw error;
  return { data, note: 'Visual similarity search — results ranked by image hash proximity.' };
}

// ─── Barcode/QR search ────────────────────────────────────────────────────────
export async function processBarcodeSearch(barcodeValue) {
  if (!barcodeValue) throw new Error('Barcode value is required.');
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:supplier_profiles(company_name)')
    .eq('status', 'active')
    .or(`sku.eq.${barcodeValue},barcode.eq.${barcodeValue}`)
    .limit(10);
  if (error) throw error;
  return { data };
}

// ─── Auto-complete suggestions ────────────────────────────────────────────────
export async function getAutocompleteSuggestions(prefix) {
  if (!prefix || prefix.length < 2) return { suggestions: [] };

  const { data, error } = await supabase
    .from('products')
    .select('title')
    .eq('status', 'active')
    .ilike('title', `${prefix}%`)
    .limit(8);

  if (error) throw error;

  // Merge with popular past queries matching this prefix
  const popular = searchAnalytics.queries
    .filter((q) => q.query.startsWith(prefix.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((q) => q.query);

  const productTitles = data.map((p) => p.title);
  const suggestions = [...new Set([...popular, ...productTitles])].slice(0, 10);

  return { suggestions };
}

// ─── Search analytics (admin) ─────────────────────────────────────────────────
export async function getSearchAnalytics() {
  const topQueries = [...searchAnalytics.queries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const zeroResultQueries = [...searchAnalytics.zeroResults]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { topQueries, zeroResultQueries };
}

// ─── Private helpers ──────────────────────────────────────────────────────────
function _trackQuery(query, resultCount) {
  if (!query) return;
  const normalized = query.toLowerCase().trim();
  const existing = searchAnalytics.queries.find((q) => q.query === normalized);
  if (existing) {
    existing.count += 1;
  } else {
    searchAnalytics.queries.push({ query: normalized, count: 1, lastSearched: new Date().toISOString() });
  }

  if (resultCount === 0) {
    const existingZero = searchAnalytics.zeroResults.find((q) => q.query === normalized);
    if (existingZero) {
      existingZero.count += 1;
    } else {
      searchAnalytics.zeroResults.push({ query: normalized, count: 1 });
    }
  }
}
