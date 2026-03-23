/**
 * Globex Sky — AI Content Generation Service
 * Uses OpenAI GPT-3.5-turbo for content generation tasks:
 * product descriptions, SEO meta, translation, content moderation, and email subjects.
 * Gracefully falls back to templates when OPENAI_API_KEY is not set.
 *
 * Environment variable: OPENAI_API_KEY
 */

import openaiClient from '../../config/openai.js';
import supabase from '../../config/supabase.js';

// ─── Product Description ──────────────────────────────────────────────────────

/**
 * Generate an SEO-optimised product description from product attributes.
 *
 * @param {string} name - product name
 * @param {string} category - product category
 * @param {object} attributes - key/value pairs of product attributes
 * @param {'professional'|'casual'|'engaging'} tone
 * @returns {Promise<string>}
 */
export async function generateProductDescription(name, category, attributes = {}, tone = 'engaging') {
  const attrText = Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ');

  if (openaiClient) {
    try {
      const prompt = `Write a ${tone} SEO-optimised product description for an e-commerce listing.
Product: ${name}
Category: ${category}
Attributes: ${attrText || 'N/A'}
Requirements: Under 150 words, highlight key benefits, include a call to action, use relevant keywords.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.8,
      });

      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      console.warn('[ContentService] generateProductDescription failed:', err.message);
    }
  }

  // Fallback template
  return `${name} — a premium ${category} product built for quality and performance. ${attrText ? `Specifications: ${attrText}.` : ''} Designed to meet the highest standards, this product delivers exceptional value. Order now for fast international shipping.`;
}

// ─── SEO Meta ─────────────────────────────────────────────────────────────────

/**
 * Generate SEO meta title, description, and keywords for a product page.
 *
 * @param {string} productName
 * @param {string} category
 * @param {string} description
 * @returns {Promise<{ title: string, description: string, keywords: string[] }>}
 */
export async function generateSeoMeta(productName, category, description) {
  if (openaiClient) {
    try {
      const prompt = `Generate SEO meta tags for a product page.
Product: ${productName}
Category: ${category}
Description: ${description?.substring(0, 300) || ''}
Return JSON only: {"title":"...","description":"...","keywords":["...","..."]}
Title: max 60 chars, description: max 155 chars, keywords: 5-8 terms.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.4,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '{}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || `${productName} | GlobexSky`,
          description: parsed.description || description?.substring(0, 155) || '',
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        };
      }
    } catch (err) {
      console.warn('[ContentService] generateSeoMeta failed:', err.message);
    }
  }

  // Fallback
  return {
    title: `${productName} | GlobexSky`,
    description: description?.substring(0, 155) || `Buy ${productName} on GlobexSky — trusted international trade platform.`,
    keywords: [productName.toLowerCase(), category.toLowerCase(), 'buy online', 'international shipping'],
  };
}

// ─── Translation ──────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = ['en', 'bn', 'ar', 'hi', 'zh', 'fr', 'es', 'de', 'pt', 'ja', 'ko'];

/**
 * Translate product content (name, description, etc.) to a target language.
 *
 * @param {object|string} content - string or { name, description, ... }
 * @param {string} targetLang - BCP-47 language code
 * @returns {Promise<object|string>} translated content in same shape
 */
export async function translateContent(content, targetLang) {
  if (!SUPPORTED_LANGUAGES.includes(targetLang)) {
    throw new Error(`Unsupported language: ${targetLang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  if (targetLang === 'en') return content;

  if (openaiClient) {
    try {
      const textToTranslate = typeof content === 'string' ? content : JSON.stringify(content);
      const isObject = typeof content !== 'string';

      const prompt = isObject
        ? `Translate the values of this JSON object to ${targetLang}. Keep keys unchanged. Return valid JSON only:\n${textToTranslate}`
        : `Translate to ${targetLang}. Return only the translation:\n${textToTranslate}`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.max(textToTranslate.length * 2, 500),
        temperature: 0.2,
      });

      const result = completion.choices[0]?.message?.content?.trim() || '';
      if (isObject) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : content;
      }
      return result || content;
    } catch (err) {
      console.warn('[ContentService] translateContent failed:', err.message);
    }
  }

  return content;
}

// ─── Content Moderation ───────────────────────────────────────────────────────

/**
 * Check review/comment text for spam or offensive content before publishing.
 * Uses OpenAI Moderation API when available.
 *
 * @param {string} text
 * @returns {Promise<{ isAllowed: boolean, categories: object, reason?: string }>}
 */
export async function moderateContent(text) {
  if (openaiClient) {
    try {
      const result = await openaiClient.moderations.create({ input: text });
      const output = result.results[0];
      const flagged = output?.flagged || false;
      return {
        isAllowed: !flagged,
        categories: output?.categories || {},
        reason: flagged ? 'Content flagged by AI moderation' : undefined,
      };
    } catch (err) {
      console.warn('[ContentService] moderateContent failed:', err.message);
    }
  }

  // Fallback: basic keyword check
  const BAD_WORDS = ['spam', 'scam', 'fake'];
  const lower = text.toLowerCase();
  const flagged = BAD_WORDS.some((w) => lower.includes(w));
  return {
    isAllowed: !flagged,
    categories: {},
    reason: flagged ? 'Content matched basic spam filter' : undefined,
  };
}

// ─── Email Subject Lines ──────────────────────────────────────────────────────

const EMAIL_SUBJECT_TEMPLATES = {
  order_confirmation: 'Your GlobexSky order #{orderId} is confirmed!',
  shipping_update: 'Your order #{orderId} has shipped — track it now',
  promotional: 'Exclusive deals just for you — shop now on GlobexSky',
  abandoned_cart: 'You left something behind — complete your purchase',
  review_request: 'How was your recent purchase? Share your review',
  password_reset: 'Reset your GlobexSky password',
  welcome: 'Welcome to GlobexSky — your global trade partner',
};

/**
 * Generate an AI-crafted email subject line for a given email type.
 *
 * @param {'order_confirmation'|'shipping_update'|'promotional'|'abandoned_cart'|'review_request'|'password_reset'|'welcome'} emailType
 * @param {object} context - dynamic values like orderId, productName, userName
 * @returns {Promise<string>}
 */
export async function generateEmailSubject(emailType, context = {}) {
  if (openaiClient) {
    try {
      const contextStr = Object.entries(context).map(([k, v]) => `${k}: ${v}`).join(', ');
      const prompt = `Write a compelling email subject line for email type: "${emailType}".${contextStr ? ` Context: ${contextStr}.` : ''} Max 60 characters. Return subject line only, no quotes.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.9,
      });

      const subject = completion.choices[0]?.message?.content?.trim();
      if (subject) return subject;
    } catch (err) {
      console.warn('[ContentService] generateEmailSubject failed:', err.message);
    }
  }

  // Fallback template with context substitution
  let template = EMAIL_SUBJECT_TEMPLATES[emailType] || `GlobexSky: ${emailType}`;
  for (const [k, v] of Object.entries(context)) {
    template = template.replace(`{${k}}`, v);
  }
  return template;
}

// ─── Review Summarisation ─────────────────────────────────────────────────────

/**
 * Summarise product reviews into pros/cons and sentiment breakdown.
 * Stores result in DB for caching.
 *
 * @param {string} productId
 * @param {Array<{ rating: number, comment: string }>} reviews
 * @returns {Promise<{ summary: string, pros: string[], cons: string[], sentiment: object, cached: boolean }>}
 */
export async function summarizeProductReviews(productId, reviews) {
  // Check cache
  const { data: cached } = await supabase
    .from('ai_review_summaries')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return { ...cached.payload, cached: true };
  }

  const positive = reviews.filter((r) => r.rating >= 4).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const neutral = reviews.length - positive - negative;
  const sentiment = {
    positive: reviews.length ? Math.round((positive / reviews.length) * 100) : 0,
    neutral: reviews.length ? Math.round((neutral / reviews.length) * 100) : 0,
    negative: reviews.length ? Math.round((negative / reviews.length) * 100) : 0,
  };

  let result = {
    summary: `Based on ${reviews.length} reviews with ${sentiment.positive}% positive feedback.`,
    pros: positive > 0 ? ['Good quality', 'Fast delivery', 'Value for money'] : [],
    cons: negative > 0 ? ['Some quality concerns', 'Delivery delays reported'] : [],
    sentiment,
    cached: false,
  };

  if (openaiClient && reviews.length > 0) {
    try {
      const sampleComments = reviews.slice(0, 50).map((r) => `[${r.rating}★] ${r.comment}`).join('\n');
      const prompt = `Summarise these product reviews:\nSUMMARY: (2 sentences)\nPROS: item1 | item2 | item3\nCONS: item1 | item2 | item3\n\nReviews:\n${sampleComments}`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      });

      const text = completion.choices[0]?.message?.content?.trim() || '';
      const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?:\n|$)/i);
      const prosMatch = text.match(/PROS:\s*(.+?)(?:\n|$)/i);
      const consMatch = text.match(/CONS:\s*(.+?)(?:\n|$)/i);

      result = {
        summary: summaryMatch?.[1]?.trim() || result.summary,
        pros: prosMatch?.[1]?.split('|').map((s) => s.trim()).filter(Boolean) || result.pros,
        cons: consMatch?.[1]?.split('|').map((s) => s.trim()).filter(Boolean) || result.cons,
        sentiment,
        cached: false,
      };
    } catch (err) {
      console.warn('[ContentService] summarizeProductReviews OpenAI failed:', err.message);
    }
  }

  // Cache result for 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('ai_review_summaries')
    .upsert([{ product_id: productId, payload: result, expires_at: expiresAt }], { onConflict: 'product_id' });

  return result;
}
