/**
 * Globex Sky — Semantic Search Service
 * OpenAI text-embedding-ada-002 for semantic product search with cosine similarity.
 * Includes voice search (Whisper), image search (GPT-4 Vision), autocomplete, and
 * smart filter extraction.  Falls back to keyword search when OpenAI is unavailable.
 *
 * Environment variable: OPENAI_API_KEY
 */

import supabase from '../../config/supabase.js';
import openaiClient from '../../config/openai.js';

// ─── In-memory embedding cache (productId → embedding vector) ────────────────
const MAX_CACHE_SIZE = 1000; // Prevent unbounded memory growth
const embeddingCache = new Map();

// ─── Ranking boost constants ──────────────────────────────────────────────────
const MAX_VIEW_COUNT_FOR_BOOST = 10000;
const MAX_POPULARITY_BOOST = 0.1;

// ─── Cosine Similarity ────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two numeric vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [0, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Embed text ───────────────────────────────────────────────────────────────

/**
 * Embed a text string using OpenAI text-embedding-ada-002.
 * Returns null if OpenAI is unavailable.
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function embedText(text) {
  if (!openaiClient) return null;
  try {
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.substring(0, 8000),
    });
    return response.data[0]?.embedding || null;
  } catch (err) {
    console.warn('[SemanticSearch] Embedding failed:', err.message);
    return null;
  }
}

// ─── Keyword fallback search ──────────────────────────────────────────────────

/**
 * Basic keyword search against Supabase products table.
 * @param {string} query
 * @param {object} filters
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function keywordSearch(query, filters = {}, limit = 20) {
  let q = supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating, view_count, description')
    .eq('status', 'active')
    .ilike('title', `%${query}%`);

  if (filters.category_id) q = q.eq('category_id', filters.category_id);
  if (filters.minPrice !== undefined) q = q.gte('price', filters.minPrice);
  if (filters.maxPrice !== undefined) q = q.lte('price', filters.maxPrice);

  const { data } = await q.limit(limit);
  return (data || []).map((p) => ({ ...p, relevanceScore: 0.5 }));
}

// ─── Semantic Search ──────────────────────────────────────────────────────────

/**
 * Perform semantic search by embedding the query and comparing against product embeddings.
 * Re-ranks by semantic similarity + user history + trending signals.
 * Falls back to keyword search if OpenAI is unavailable.
 *
 * @param {string} query
 * @param {{ category_id?: string, minPrice?: number, maxPrice?: number, limit?: number }} filters
 * @param {string|null} userId
 * @returns {Promise<{ products: object[], query: string, method: string }>}
 */
export async function semanticSearch(query, filters = {}, userId = null) {
  const limit = Math.min(Number(filters.limit) || 20, 100);
  const queryEmbedding = await embedText(query);

  if (!queryEmbedding) {
    // Fallback to keyword search
    const products = await keywordSearch(query, filters, limit);
    return { products, query, method: 'keyword' };
  }

  // Fetch candidate products (up to 200 for ranking)
  let q = supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating, view_count, description')
    .eq('status', 'active');

  if (filters.category_id) q = q.eq('category_id', filters.category_id);
  if (filters.minPrice !== undefined) q = q.gte('price', filters.minPrice);
  if (filters.maxPrice !== undefined) q = q.lte('price', filters.maxPrice);

  const { data: products } = await q.limit(200);
  if (!products?.length) return { products: [], query, method: 'semantic' };

  // Embed product titles (with in-memory cache)
  const scored = await Promise.all(
    products.map(async (p) => {
      let embedding = embeddingCache.get(p.id);
      if (!embedding) {
        const text = `${p.title} ${p.description || ''}`.substring(0, 500);
        embedding = await embedText(text);
        if (embedding) {
        // Evict oldest entry when cache is full
        if (embeddingCache.size >= MAX_CACHE_SIZE) {
          embeddingCache.delete(embeddingCache.keys().next().value);
        }
        embeddingCache.set(p.id, embedding);
      }
      }
      const similarity = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;

      // Boost by popularity signals
      const popularityBoost = Math.min((p.view_count || 0) / MAX_VIEW_COUNT_FOR_BOOST, MAX_POPULARITY_BOOST);
      const ratingBoost = ((p.average_rating || 3) - 3) * 0.02;

      return { ...p, relevanceScore: similarity + popularityBoost + ratingBoost };
    }),
  );

  // Sort by score descending and slice
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return { products: scored.slice(0, limit), query, method: 'semantic' };
}

// ─── Voice Search ─────────────────────────────────────────────────────────────

/**
 * Transcribe an audio buffer using OpenAI Whisper and perform semantic search.
 * Falls back to error message when OpenAI is unavailable.
 *
 * @param {Buffer|null} audioBuffer - raw audio data (multipart upload)
 * @param {string|null} transcription - pre-supplied transcription (for clients that transcribe locally)
 * @param {object} filters
 * @returns {Promise<{ transcription: string, products: object[], method: string }>}
 */
export async function voiceSearch(audioBuffer, transcription = null, filters = {}) {
  let text = transcription;

  if (!text && audioBuffer && openaiClient) {
    try {
      const { Readable } = await import('stream');
      const stream = Readable.from(audioBuffer);
      stream.path = 'audio.webm'; // Whisper requires a filename hint

      const result = await openaiClient.audio.transcriptions.create({
        file: stream,
        model: 'whisper-1',
      });
      text = result.text;
    } catch (err) {
      console.warn('[SemanticSearch] Whisper transcription failed:', err.message);
      return { transcription: '', products: [], method: 'whisper_failed', error: 'Transcription failed' };
    }
  }

  if (!text) return { transcription: '', products: [], method: 'no_audio' };

  const { products, method } = await semanticSearch(text, filters);
  return { transcription: text, products, method };
}

// ─── Image Search ─────────────────────────────────────────────────────────────

/**
 * Extract product attributes from an image using GPT-4 Vision and search for matches.
 * Falls back to an empty result when OpenAI is unavailable.
 *
 * @param {string} imageBase64 - base64-encoded image
 * @param {string|null} imageUrl - optional public URL (used if no base64)
 * @returns {Promise<{ extractedAttributes: object, products: object[], method: string }>}
 */
export async function imageSearch(imageBase64, imageUrl = null) {
  if (!openaiClient) {
    return { extractedAttributes: {}, products: [], method: 'openai_unavailable' };
  }

  const imageContent = imageBase64
    ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
    : { type: 'image_url', image_url: { url: imageUrl } };

  let attributes = {};
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: 'Identify this product. Return JSON only with keys: productType, color, style, brand, keywords (array of 5 search terms). Example: {"productType":"shoes","color":"red","style":"casual","brand":"unknown","keywords":["red shoes","casual sneakers"]}',
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) attributes = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[SemanticSearch] Image search vision call failed:', err.message);
    return { extractedAttributes: {}, products: [], method: 'vision_failed' };
  }

  // Search using extracted keywords
  const searchQuery = [
    attributes.productType,
    attributes.color,
    attributes.style,
    ...(attributes.keywords || []),
  ].filter(Boolean).join(' ');

  const { products, method } = await semanticSearch(searchQuery, {});
  return { extractedAttributes: attributes, products, method: `vision_${method}` };
}

// ─── Auto-complete ────────────────────────────────────────────────────────────

/**
 * Generate search suggestions for a partial query.
 * Uses popular searches from DB + GPT-generated completions.
 *
 * @param {string} partialQuery
 * @returns {Promise<string[]>} up to 8 suggestions
 */
export async function autoComplete(partialQuery) {
  if (!partialQuery?.trim()) return [];

  // DB popular searches
  const { data: popular } = await supabase
    .from('search_logs')
    .select('query')
    .ilike('query', `${partialQuery}%`)
    .order('count', { ascending: false })
    .limit(4);

  const dbSuggestions = (popular || []).map((r) => r.query);

  if (openaiClient) {
    try {
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `Generate 4 e-commerce search query completions for: "${partialQuery}". Return as JSON array of strings only. Focus on product names, categories, and brands.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      });
      const raw = completion.choices[0]?.message?.content?.trim() || '[]';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const aiSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      const combined = [...new Set([...dbSuggestions, ...aiSuggestions])].slice(0, 8);
      return combined;
    } catch (_err) {
      // Fall through
    }
  }

  return dbSuggestions.slice(0, 8);
}

// ─── Smart Filter Extraction ──────────────────────────────────────────────────

/**
 * Extract structured filters from a natural language query using GPT.
 * Falls back to empty filters when OpenAI is unavailable.
 *
 * @param {string} query - e.g. "red shoes under 500"
 * @returns {Promise<{ category?: string, color?: string, maxPrice?: number, minPrice?: number, brand?: string, keywords: string[] }>}
 */
export async function generateSearchFilters(query) {
  if (!openaiClient) return { keywords: [query] };

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Extract structured search filters from this query: "${query}".\nReturn JSON only with these optional keys: category, color, maxPrice (number), minPrice (number), brand, keywords (array).\nExample: {"category":"shoes","color":"red","maxPrice":500,"keywords":["red shoes"]}`,
        },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { keywords: [query] };
  } catch (_err) {
    return { keywords: [query] };
  }
}
