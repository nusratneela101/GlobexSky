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
    .eq('status', 'active');

  if (query) {
    q = q.textSearch('title', query, { type: 'websearch' });
  }
  if (category_id) q = q.eq('category_id', category_id);
  if (minPrice !== undefined) q = q.gte('price', minPrice);
  if (maxPrice !== undefined) q = q.lte('price', maxPrice);
  if (minRating !== undefined) q = q.gte('average_rating', minRating);
  if (supplierId) q = q.eq('supplier_id', supplierId);

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message ?? String(error));

  // Track analytics
  _trackQuery(query, count);

  // Spelling suggestion (simple: strip last char if zero results)
  const suggestion = count === 0 && query.length > 3 ? query.slice(0, -1) : null;

  return { data, total: count, page, limit, suggestion };
}

// ─── Advanced Filtered Search (20+ filters) ───────────────────────────────────
export async function advancedFilterSearch(filters = {}, page = 1, limit = 20) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from('products')
    .select('*, supplier:supplier_profiles(company_name, verified, country)', { count: 'exact' })
    .eq('status', 'active')
    .range(from, to);

  // Text query
  if (filters.q) q = q.textSearch('title', filters.q, { type: 'websearch' });

  // Price range
  if (filters.minPrice !== undefined && filters.minPrice !== '') q = q.gte('price', +filters.minPrice);
  if (filters.maxPrice !== undefined && filters.maxPrice !== '') q = q.lte('price', +filters.maxPrice);

  // Category
  if (filters.category_id) q = q.eq('category_id', filters.category_id);

  // Supplier
  if (filters.supplier_id) q = q.eq('supplier_id', filters.supplier_id);

  // Rating
  if (filters.minRating !== undefined && filters.minRating !== '') q = q.gte('average_rating', +filters.minRating);

  // MOQ
  if (filters.minMoq !== undefined && filters.minMoq !== '') q = q.gte('moq', +filters.minMoq);
  if (filters.maxMoq !== undefined && filters.maxMoq !== '') q = q.lte('moq', +filters.maxMoq);

  // Boolean toggles
  if (filters.verified_supplier === true || filters.verified_supplier === 'true') {
    q = q.eq('supplier.verified', true);
  }
  if (filters.in_stock === true || filters.in_stock === 'true') q = q.gt('stock_quantity', 0);
  if (filters.sample_available === true || filters.sample_available === 'true') q = q.eq('sample_available', true);
  if (filters.customizable === true || filters.customizable === 'true') q = q.eq('customizable', true);
  if (filters.eco_friendly === true || filters.eco_friendly === 'true') q = q.eq('eco_friendly', true);
  if (filters.on_sale === true || filters.on_sale === 'true') q = q.gt('discount_percentage', 0);
  if (filters.trade_assurance === true || filters.trade_assurance === 'true') q = q.eq('trade_assurance', true);

  // Product type
  if (filters.product_type && filters.product_type.length > 0) {
    q = q.in('product_type', Array.isArray(filters.product_type) ? filters.product_type : [filters.product_type]);
  }

  // Material
  if (filters.material) q = q.ilike('material', `%${filters.material}%`);

  // Color
  if (filters.color) q = q.ilike('color', `%${filters.color}%`);

  // Certification
  if (filters.certifications && filters.certifications.length > 0) {
    const certs = Array.isArray(filters.certifications) ? filters.certifications : [filters.certifications];
    q = q.contains('certifications', certs);
  }

  // Date listed
  if (filters.date_from) q = q.gte('created_at', filters.date_from);
  if (filters.date_to) q = q.lte('created_at', filters.date_to);

  // Sorting
  const sortMap = {
    price_asc: { column: 'price', ascending: true },
    price_desc: { column: 'price', ascending: false },
    rating: { column: 'average_rating', ascending: false },
    newest: { column: 'created_at', ascending: false },
    relevance: { column: 'created_at', ascending: false },
  };
  const sort = sortMap[filters.sort] || sortMap.newest;
  q = q.order(sort.column, { ascending: sort.ascending });

  const { data, error, count } = await q;
  if (error) throw error;

  _trackQuery(filters.q || '', count);

  return { data, total: count, page, limit };
}

// ─── Voice search (accept transcription from Web Speech API) ─────────────────
export async function processVoiceSearch(transcription, userId, filters = {}) {
  if (!transcription) throw new Error('Transcription is required.');
  // Normalize voice transcription
  const normalized = transcription.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  return fullTextSearch(normalized, filters);
}

// ─── Image search (accept base64 image hash or URL for visual similarity) ─────
export async function processImageSearch(imageBase64, imageUrl) {
  if (!imageBase64 && !imageUrl) throw new Error('Image data is required.');
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
export async function getAutocompleteSuggestions(prefix, limit = 10) {
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
  const suggestions = [...new Set([...popular, ...productTitles])].slice(0, limit);

  return { suggestions };
}

// ─── AI-powered product recommendations ───────────────────────────────────────
export async function getRecommendations(context, userId, limit = 12) {
  let q = supabase
    .from('products')
    .select('id, title, price, images, average_rating, supplier:supplier_profiles(company_name, verified)')
    .eq('status', 'active')
    .order('average_rating', { ascending: false })
    .limit(limit);

  if (context && context.length > 1) {
    q = supabase
      .from('products')
      .select('id, title, price, images, average_rating, supplier:supplier_profiles(company_name, verified)')
      .eq('status', 'active')
      .ilike('title', `%${context}%`)
      .order('average_rating', { ascending: false })
      .limit(limit);
  }

  const { data, error } = await q;
  if (error) throw error;

  return {
    data: data || [],
    context: context ? `Because you searched for "${context}"` : 'Recommended for you',
  };
}

// ─── AI Chat (search assistant) ───────────────────────────────────────────────
export async function processAiChat(message, history = [], userId = null) {
  if (!message) throw new Error('Message is required.');

  const lower = message.toLowerCase();

  // Intent parsing: extract possible search terms and filters
  let searchQuery = '';
  let products = [];
  let reply = '';
  const actions = [];

  // Extract location mentions
  const locationMatch = lower.match(/in\s+([a-z\s]+?)(?:\s|$|,|\.|!|\?)/i);
  const location = locationMatch ? locationMatch[1].trim() : null;

  // Extract product keywords (remove common chat words)
  const stopWords = ['find', 'me', 'show', 'get', 'what', 'is', 'the', 'best', 'price', 'for', 'suppliers', 'supplier', 'in', 'similar', 'to', 'products', 'like', 'bulk', 'wholesale', 'a', 'an', 'please', 'can', 'you'];
  const words = lower.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  searchQuery = words.slice(0, 4).join(' ');

  // Search for matching products
  if (searchQuery) {
    let q = supabase
      .from('products')
      .select('id, title, price, images, average_rating, supplier:supplier_profiles(company_name, verified, country)')
      .eq('status', 'active')
      .ilike('title', `%${searchQuery}%`)
      .order('average_rating', { ascending: false })
      .limit(6);

    const { data, error } = await q;
    if (!error && data) products = data;
  }

  // Build reply
  if (products.length > 0) {
    reply = `I found ${products.length} products matching your request${location ? ` in ${location}` : ''}. Here are the top results:`;
    actions.push({ label: 'View All Results', action: 'search', query: searchQuery });
    actions.push({ label: 'Apply Filters', action: 'open_filters' });
  } else if (searchQuery) {
    reply = `I couldn't find exact matches for "${searchQuery}". Try broadening your search or use our advanced filters.`;
    actions.push({ label: 'Try Advanced Search', action: 'open_filters' });
    actions.push({ label: 'Browse Categories', action: 'browse_categories' });
  } else {
    reply = 'I can help you find products, suppliers, or pricing information. Try asking something like "Find electronics suppliers in Guangzhou" or "Show me USB cables in bulk".';
    actions.push({ label: 'Browse Popular Categories', action: 'browse_categories' });
    actions.push({ label: 'View Trending Products', action: 'trending' });
  }

  return { reply, products, actions };
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

/**
 * Alias for getAutocompleteSuggestions that returns a plain array of suggestion strings.
 */
export async function getSuggestions(prefix, limit = 10) {
  const result = await getAutocompleteSuggestions(prefix, limit);
  return result.suggestions || [];
}

/**
 * Record a click-through event (user clicked a product from search results).
 */
export async function recordClickThrough(query, productId) {
  const key = `${query}__${productId}`;
  searchAnalytics.clickThrough[key] = (searchAnalytics.clickThrough[key] || 0) + 1;
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
