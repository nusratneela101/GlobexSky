/**
 * backend/services/imageSearch.service.js
 *
 * AI Image Search service — multi-provider support.
 * Supported providers: openai, google_vision, azure_cv, clarifai
 *
 * All API keys are read from the image_search_config DB table (never from .env).
 * Falls back to the next available provider if the primary one fails.
 */

import ImageSearch from '../models/ImageSearch.js';
import supabase from '../config/supabase.js';

// ─── Provider Implementations ──────────────────────────────────────────────

/**
 * Analyse an image with OpenAI Vision (GPT-4o).
 * @param {string} base64Image - base64-encoded image (no data-URI prefix)
 * @param {string} apiKey
 * @returns {Promise<{ tags: string[], description: string }>}
 */
async function analyzeWithOpenAI(base64Image, apiKey) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this product image. Return a JSON object with: "tags" (array of descriptive keywords for product search), "description" (brief product description), "category" (product category), "colors" (array of main colors). Be concise and focus on searchable product attributes.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'low' },
          },
        ],
      },
    ],
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return {
    tags: parsed.tags || [],
    description: parsed.description || '',
    category: parsed.category || '',
    colors: parsed.colors || [],
  };
}

/**
 * Analyse an image with Google Cloud Vision.
 * @param {string} base64Image
 * @param {string} apiKey
 * @returns {Promise<{ tags: string[], description: string }>}
 */
async function analyzeWithGoogleVision(base64Image, apiKey) {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 20 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          { type: 'IMAGE_PROPERTIES', maxResults: 5 },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Google Vision API error: ${res.status}`);
  const data = await res.json();

  const response = data.responses?.[0] || {};
  const labels = (response.labelAnnotations || []).map((l) => l.description);
  const objects = (response.localizedObjectAnnotations || []).map((o) => o.name);
  const tags = [...new Set([...labels, ...objects])];

  return { tags, description: tags.slice(0, 5).join(', '), category: objects[0] || '', colors: [] };
}

/**
 * Analyse an image with Azure Computer Vision.
 * @param {string} base64Image
 * @param {string} endpoint
 * @param {string} apiKey
 * @returns {Promise<{ tags: string[], description: string }>}
 */
async function analyzeWithAzureCV(base64Image, endpoint, apiKey) {
  const url = `${endpoint.replace(/\/$/, '')}/vision/v3.2/analyze?visualFeatures=Tags,Description,Color,Objects`;
  const imageBuffer = Buffer.from(base64Image, 'base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!res.ok) throw new Error(`Azure CV API error: ${res.status}`);
  const data = await res.json();

  const tags = (data.tags || []).map((t) => t.name);
  const description = data.description?.captions?.[0]?.text || tags.slice(0, 5).join(', ');
  const colors = data.color?.dominantColors || [];

  return { tags, description, category: tags[0] || '', colors };
}

/**
 * Analyse an image with Clarifai.
 * @param {string} base64Image
 * @param {string} apiKey
 * @returns {Promise<{ tags: string[], description: string }>}
 */
async function analyzeWithClarifai(base64Image, apiKey) {
  const url = 'https://api.clarifai.com/v2/models/general-image-recognition/outputs';
  const body = {
    inputs: [{ data: { image: { base64: base64Image } } }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Clarifai API error: ${res.status}`);
  const data = await res.json();

  const concepts = data.outputs?.[0]?.data?.concepts || [];
  const tags = concepts.map((c) => c.name);
  const description = tags.slice(0, 5).join(', ');

  return { tags, description, category: tags[0] || '', colors: [] };
}

// ─── Config helpers ────────────────────────────────────────────────────────

/** Load all image_search_config values into a plain object. */
async function loadConfig() {
  const { data } = await supabase
    .from('image_search_config')
    .select('key, value, is_encrypted');
  const cfg = {};
  (data || []).forEach(({ key, value }) => { cfg[key] = value; });
  return cfg;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Analyse an image buffer using the configured AI provider.
 * Falls back to the next available provider if the primary fails.
 *
 * @param {Buffer|string} imageBufferOrBase64 - image Buffer or base64 string
 * @param {string} [providerOverride] - force a specific provider (optional)
 * @returns {Promise<{ features: object, provider: string }>}
 */
export async function analyzeImage(imageBufferOrBase64, providerOverride) {
  const cfg = await loadConfig();

  const base64 =
    typeof imageBufferOrBase64 === 'string'
      ? imageBufferOrBase64
      : imageBufferOrBase64.toString('base64');

  const primaryProvider = providerOverride || cfg.primary_provider || 'openai';

  // Build ordered provider list: primary first, then the others as fallbacks
  const allProviders = ['openai', 'google_vision', 'azure_cv', 'clarifai'];
  const orderedProviders = [
    primaryProvider,
    ...allProviders.filter((p) => p !== primaryProvider),
  ];

  const errors = [];

  for (const provider of orderedProviders) {
    try {
      let features;
      switch (provider) {
        case 'openai': {
          const key = cfg.openai_api_key;
          if (!key) throw new Error('OpenAI API key not configured.');
          features = await analyzeWithOpenAI(base64, key);
          break;
        }
        case 'google_vision': {
          const key = cfg.google_vision_api_key;
          if (!key) throw new Error('Google Vision API key not configured.');
          features = await analyzeWithGoogleVision(base64, key);
          break;
        }
        case 'azure_cv': {
          const ep = cfg.azure_cv_endpoint;
          const key = cfg.azure_cv_api_key;
          if (!ep || !key) throw new Error('Azure CV endpoint or API key not configured.');
          features = await analyzeWithAzureCV(base64, ep, key);
          break;
        }
        case 'clarifai': {
          const key = cfg.clarifai_api_key;
          if (!key) throw new Error('Clarifai API key not configured.');
          features = await analyzeWithClarifai(base64, key);
          break;
        }
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      return { features, provider };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }

  // All providers failed — return mock features in test mode
  if (cfg.mode === 'test') {
    return {
      features: {
        tags: ['product', 'item', 'goods'],
        description: 'Test mode — AI provider not configured',
        category: 'General',
        colors: [],
      },
      provider: 'mock',
    };
  }

  throw new Error(`All AI providers failed. Errors: ${errors.join('; ')}`);
}

/**
 * Find similar products in the catalog based on extracted image features.
 *
 * @param {object} features - { tags, description, category, colors }
 * @param {number} [maxResults=20]
 * @returns {Promise<object[]>}
 */
export async function findSimilarProducts(features, maxResults = 20) {
  const { tags = [], description = '', category = '' } = features;

  // Build a search query from tags and description
  const searchTerms = [...new Set([...tags.slice(0, 10), ...description.split(' ')])].filter(Boolean);

  if (!searchTerms.length) return [];

  // Full-text search against products table using multiple term matching
  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, images, category_id, status, stock_quantity')
    .eq('status', 'active')
    .gt('stock_quantity', 0)
    .limit(maxResults * 3);

  if (!products?.length) return [];

  // Score each product by tag relevance (simple keyword matching)
  const scored = products.map((product) => {
    const text = `${product.name} ${product.description}`.toLowerCase();
    let score = 0;
    for (const term of searchTerms) {
      if (text.includes(term.toLowerCase())) score += 1;
    }
    if (category && text.includes(category.toLowerCase())) score += 3;
    return { ...product, _score: score };
  });

  return scored
    .filter((p) => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, maxResults)
    .map(({ _score, ...p }) => p);
}

/**
 * Search by image URL — fetch the image, convert to base64, then analyze.
 * @param {string} imageUrl
 * @returns {Promise<string>} base64 string
 */
export async function fetchImageAsBase64(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image from URL: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

/**
 * Test a provider connection by analyzing a tiny 1x1 white pixel PNG.
 * @param {string} provider
 * @returns {Promise<{ success: boolean, message: string, provider: string }>}
 */
export async function testProviderConnection(provider) {
  // 1×1 white pixel PNG in base64
  const testImage =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    const { features, provider: usedProvider } = await analyzeImage(testImage, provider);
    return {
      success: true,
      message: `Connection to ${usedProvider} successful. Detected ${features.tags?.length ?? 0} tags.`,
      provider: usedProvider,
    };
  } catch (err) {
    return { success: false, message: err.message, provider };
  }
}

/**
 * Persist config updates (wraps ImageSearch.saveConfig).
 * @param {object} updates - { key: value }
 * @param {string} [actorId]
 * @returns {Promise<object[]>}
 */
export async function saveConfig(updates, actorId) {
  return ImageSearch.saveConfig(updates, actorId);
}
