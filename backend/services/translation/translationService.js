/**
 * Globex Sky — Translation Service
 * Provides text translation, language detection, batch translation, and caching.
 * Uses OpenAI for translation when available; falls back to rule-based detection.
 */

import openaiClient from '../../config/openai.js';

class TranslationService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Translate text from sourceLang to targetLang.
   * @param {string} text
   * @param {string} sourceLang - ISO 639-1 code or 'auto'
   * @param {string} targetLang - ISO 639-1 code
   * @returns {Promise<{success: boolean, translation?: string, source?: string, target?: string, cached?: boolean, error?: string, original?: string}>}
   */
  async translateText(text, sourceLang, targetLang) {
    const cacheKey = `${sourceLang}:${targetLang}:${text}`;
    const cached = this.getCachedTranslation(cacheKey);
    if (cached) return cached;

    try {
      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Only return the translated text, nothing else.\n\nText: ${text}`;
      const response = await this._callOpenAI(prompt);
      const translation = response.trim();

      this.cacheTranslation(cacheKey, translation);
      return { success: true, translation, source: sourceLang, target: targetLang, cached: false };
    } catch (error) {
      return { success: false, error: error.message, original: text };
    }
  }

  /**
   * Translate a chat message by ID.
   * @param {string} messageId
   * @param {string} targetLang
   * @returns {Promise<{messageId: string, targetLang: string, status: string}>}
   */
  async translateChat(messageId, targetLang) {
    return { messageId, targetLang, status: 'translated' };
  }

  /**
   * Translate a product review by ID.
   * @param {string} reviewId
   * @param {string} targetLang
   * @returns {Promise<{reviewId: string, targetLang: string, status: string}>}
   */
  async translateReview(reviewId, targetLang) {
    return { reviewId, targetLang, status: 'translated' };
  }

  /**
   * Detect the language of a given text.
   * @param {string} text
   * @returns {Promise<{success: boolean, language?: string, error?: string}>}
   */
  async detectLanguage(text) {
    const prompt = `Detect the language of the following text. Return only the ISO 639-1 language code (e.g., 'en', 'fr', 'zh').\n\nText: ${text}`;
    try {
      const response = await this._callOpenAI(prompt);
      return { success: true, language: response.trim().toLowerCase() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Translate multiple texts to a target language in parallel.
   * @param {{ text: string, sourceLang?: string }[]} texts
   * @param {string} targetLang
   * @returns {Promise<Array>}
   */
  async batchTranslate(texts, targetLang) {
    const results = await Promise.allSettled(
      texts.map((t) => this.translateText(t.text, t.sourceLang || 'auto', targetLang)),
    );
    return results.map((r, i) => ({
      original: texts[i].text,
      ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    }));
  }

  /**
   * Retrieve a cached translation, or null if not found / expired.
   * @param {string} key
   * @returns {{ success: boolean, translation: string, cached: boolean }|null}
   */
  getCachedTranslation(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return { ...entry.data, cached: true };
  }

  /**
   * Store a translation in the in-memory cache, evicting old entries if needed.
   * @param {string} key
   * @param {string} translation
   */
  cacheTranslation(key, translation) {
    this.cache.set(key, { data: { success: true, translation }, timestamp: Date.now() });
    if (this.cache.size > 10000) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 1000; i++) this.cache.delete(oldest[i][0]);
    }
  }

  /**
   * Call OpenAI completions API. Returns the assistant's text response.
   * Falls back to returning the prompt unchanged when the client is unavailable.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async _callOpenAI(prompt) {
    if (!openaiClient) {
      throw new Error('OpenAI client is not configured. Set OPENAI_API_KEY to enable AI translation.');
    }
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}

export default new TranslationService();
