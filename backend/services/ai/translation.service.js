/**
 * Globex Sky — AI Translation Service
 * Real-time message translation, product/review translation, language detection,
 * batch translation, translation caching, and locale integration.
 */

import { createHash } from 'crypto';
import supabase from '../../config/supabase.js';

// ─── Language Detection Patterns ──────────────────────────────────────────────

const LANGUAGE_PATTERNS = [
  { lang: 'ar', re: /[\u0600-\u06FF]/ },
  { lang: 'zh', re: /[\u4E00-\u9FFF]/ },
  { lang: 'ja', re: /[\u3040-\u30FF]/ },
  { lang: 'ko', re: /[\uAC00-\uD7AF]/ },
  { lang: 'ru', re: /[\u0400-\u04FF]/ },
  { lang: 'de', re: /\b(und|der|die|das|ein|ist|nicht|mit|von|sich)\b/i },
  { lang: 'fr', re: /\b(le|la|les|un|une|des|est|avec|pour|dans)\b/i },
  { lang: 'es', re: /\b(el|la|los|las|un|una|es|con|para|en)\b/i },
  { lang: 'pt', re: /\b(o|a|os|as|um|uma|é|com|para|em)\b/i },
  { lang: 'it', re: /\b(il|la|i|le|un|una|è|con|per|in)\b/i },
];

// ─── Built-in Translation Dictionary (phrase-level for common UI strings) ─────

const PHRASE_TRANSLATIONS = {
  en: {
    'Add to cart': 'Add to cart',
    'Buy now': 'Buy now',
    'Out of stock': 'Out of stock',
    'Free shipping': 'Free shipping',
  },
  ar: {
    'Add to cart': 'أضف إلى السلة',
    'Buy now': 'اشتري الآن',
    'Out of stock': 'نفذ المخزون',
    'Free shipping': 'شحن مجاني',
  },
  fr: {
    'Add to cart': 'Ajouter au panier',
    'Buy now': 'Acheter maintenant',
    'Out of stock': 'Rupture de stock',
    'Free shipping': 'Livraison gratuite',
  },
  es: {
    'Add to cart': 'Añadir al carrito',
    'Buy now': 'Comprar ahora',
    'Out of stock': 'Agotado',
    'Free shipping': 'Envío gratuito',
  },
  de: {
    'Add to cart': 'In den Warenkorb',
    'Buy now': 'Jetzt kaufen',
    'Out of stock': 'Nicht auf Lager',
    'Free shipping': 'Kostenloser Versand',
  },
  zh: {
    'Add to cart': '加入购物车',
    'Buy now': '立即购买',
    'Out of stock': '缺货',
    'Free shipping': '免费送货',
  },
};

// ─── Language Detection ───────────────────────────────────────────────────────

/**
 * Detect the language of a text string.
 * @param {string} text
 * @returns {string} BCP-47 language code
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  for (const { lang, re } of LANGUAGE_PATTERNS) {
    if (re.test(text)) return lang;
  }
  return 'en'; // Default to English
}

// ─── Cache Key Helper ─────────────────────────────────────────────────────────

/**
 * Generate a collision-resistant cache key for a text/language pair.
 */
function makeCacheKey(text, targetLang) {
  const hash = createHash('sha256').update(text).digest('hex').substring(0, 32);
  return `${targetLang}:${hash}`;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

async function getTranslationCache(text, targetLang) {
  const cacheKey = makeCacheKey(text, targetLang);
  const { data } = await supabase
    .from('translation_cache')
    .select('translated_text')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  return data?.translated_text || null;
}

async function setTranslationCache(text, targetLang, translatedText) {
  const cacheKey = makeCacheKey(text, targetLang);
  await supabase
    .from('translation_cache')
    .upsert([{ cache_key: cacheKey, source_text: text.substring(0, 500), translated_text: translatedText, target_lang: targetLang }], {
      onConflict: 'cache_key',
    });
}

// ─── Core Translation ─────────────────────────────────────────────────────────

/**
 * Translate text to a target language.
 * Uses built-in phrase dictionary first, then falls back to DB-stored translations.
 * In production, integrate with DeepL/Google Translate API.
 * @param {string} text
 * @param {string} targetLang
 * @param {string} sourceLang
 * @returns {{ translated: string, source_lang: string, target_lang: string, cached: boolean }}
 */
export async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text) return { translated: '', source_lang: sourceLang, target_lang: targetLang, cached: false };

  const detectedLang = sourceLang === 'auto' ? detectLanguage(text) : sourceLang;
  if (detectedLang === targetLang) {
    return { translated: text, source_lang: detectedLang, target_lang: targetLang, cached: false };
  }

  // 1. Check phrase dictionary
  const phrases = PHRASE_TRANSLATIONS[targetLang];
  if (phrases && phrases[text]) {
    return { translated: phrases[text], source_lang: detectedLang, target_lang: targetLang, cached: true };
  }

  // 2. Check translation cache
  const cached = await getTranslationCache(text, targetLang);
  if (cached) {
    return { translated: cached, source_lang: detectedLang, target_lang: targetLang, cached: true };
  }

  // 3. Simulate translation (placeholder until external API is integrated)
  // In production: call DeepL/Google/Azure Translate here
  const translated = `[${targetLang.toUpperCase()}] ${text}`;

  await setTranslationCache(text, targetLang, translated);

  return { translated, source_lang: detectedLang, target_lang: targetLang, cached: false };
}

// ─── Chat Message Translation ─────────────────────────────────────────────────

/**
 * Translate a chat message in real time.
 * @param {string} messageId - ID in chat_messages table
 * @param {string} targetLang
 */
export async function translateChatMessage(messageId, targetLang) {
  const { data: msg, error } = await supabase
    .from('chat_messages')
    .select('id, content, language')
    .eq('id', messageId)
    .single();
  if (error) throw error;

  const result = await translateText(msg.content, targetLang, msg.language || 'auto');

  // Store translated message
  await supabase.from('chat_message_translations').upsert([{
    message_id: messageId,
    target_lang: targetLang,
    translated_content: result.translated,
  }], { onConflict: 'message_id,target_lang' });

  return result;
}

// ─── Product Description Translation ─────────────────────────────────────────

/**
 * Translate a product's title and description.
 * @param {string} productId
 * @param {string} targetLang
 */
export async function translateProduct(productId, targetLang) {
  const { data: product, error } = await supabase
    .from('products')
    .select('id, title, description')
    .eq('id', productId)
    .single();
  if (error) throw error;

  const [titleResult, descResult] = await Promise.all([
    translateText(product.title, targetLang),
    product.description ? translateText(product.description, targetLang) : Promise.resolve({ translated: '' }),
  ]);

  // Upsert into product_translations table
  await supabase.from('product_translations').upsert([{
    product_id: productId,
    lang: targetLang,
    title: titleResult.translated,
    description: descResult.translated || null,
  }], { onConflict: 'product_id,lang' });

  return {
    product_id: productId,
    target_lang: targetLang,
    title: titleResult.translated,
    description: descResult.translated,
  };
}

// ─── Review Translation ───────────────────────────────────────────────────────

/**
 * Translate a product review.
 * @param {string} reviewId
 * @param {string} targetLang
 */
export async function translateReview(reviewId, targetLang) {
  const { data: review, error } = await supabase
    .from('reviews')
    .select('id, comment, language')
    .eq('id', reviewId)
    .single();
  if (error) throw error;

  const result = await translateText(review.comment || '', targetLang, review.language || 'auto');

  await supabase.from('review_translations').upsert([{
    review_id: reviewId,
    target_lang: targetLang,
    translated_comment: result.translated,
  }], { onConflict: 'review_id,target_lang' });

  return result;
}

// ─── Batch Translation ────────────────────────────────────────────────────────

/**
 * Translate multiple texts at once.
 * @param {string[]} texts
 * @param {string} targetLang
 * @param {string} sourceLang
 */
export async function batchTranslate(texts, targetLang, sourceLang = 'auto') {
  const results = await Promise.allSettled(
    texts.map((text) => translateText(text, targetLang, sourceLang)),
  );

  return results.map((r, i) => ({
    index: i,
    original: texts[i],
    ...(r.status === 'fulfilled' ? r.value : { translated: texts[i], error: r.reason?.message }),
  }));
}

// ─── Locale Integration ───────────────────────────────────────────────────────

/**
 * Get supported languages from the locales system.
 */
export async function getSupportedLanguages() {
  const { data } = await supabase
    .from('locales')
    .select('code, name, native_name, is_active')
    .eq('is_active', true)
    .order('name');

  // Fallback list if locales table doesn't exist
  const fallback = [
    { code: 'en', name: 'English', native_name: 'English' },
    { code: 'ar', name: 'Arabic', native_name: 'العربية' },
    { code: 'fr', name: 'French', native_name: 'Français' },
    { code: 'es', name: 'Spanish', native_name: 'Español' },
    { code: 'de', name: 'German', native_name: 'Deutsch' },
    { code: 'zh', name: 'Chinese', native_name: '中文' },
    { code: 'pt', name: 'Portuguese', native_name: 'Português' },
    { code: 'ru', name: 'Russian', native_name: 'Русский' },
    { code: 'ja', name: 'Japanese', native_name: '日本語' },
    { code: 'ko', name: 'Korean', native_name: '한국어' },
  ];

  return data?.length ? data : fallback;
}
