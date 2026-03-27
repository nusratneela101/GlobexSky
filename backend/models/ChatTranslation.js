import crypto from 'crypto';
import BaseModel from './BaseModel.js';

const MASKED_VALUE = '••••••••';

/**
 * ChatTranslation model
 *
 * Table: chat_translations
 * Provides translation storage, caching, and config management
 * for the real-time chat translation system.
 */
export default class ChatTranslation extends BaseModel {
  static get tableName() {
    return 'chat_translations';
  }

  /**
   * Store a translation record.
   * @param {object} params
   * @param {string} params.message_id
   * @param {string} params.original_text
   * @param {string} params.translated_text
   * @param {string} params.source_language
   * @param {string} params.target_language
   * @param {string} [params.provider='google']
   * @param {number} [params.confidence=0]
   * @param {boolean} [params.cached=false]
   * @param {number} [params.processing_time_ms=0]
   * @returns {Promise<object>}
   */
  static async translate(params) {
    const result = await this.db
      .from(this.tableName)
      .insert({
        message_id: params.message_id,
        original_text: params.original_text,
        translated_text: params.translated_text,
        source_language: params.source_language,
        target_language: params.target_language,
        provider: params.provider || 'google',
        confidence: params.confidence || 0,
        cached: params.cached || false,
        processing_time_ms: params.processing_time_ms || 0,
      })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get translation for a message in a target language.
   * @param {string} messageId
   * @param {string} targetLanguage
   * @returns {Promise<object|null>}
   */
  static async getTranslation(messageId, targetLanguage) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('message_id', messageId)
      .eq('target_language', targetLanguage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Get cached translation from the translation_cache table.
   * @param {string} text
   * @param {string} sourceLang
   * @param {string} targetLang
   * @returns {Promise<object|null>}
   */
  static async getCached(text, sourceLang, targetLang) {
    const textHash = crypto.createHash('sha256').update(text).digest('hex');
    const { data, error } = await this.db
      .from('translation_cache')
      .select('*')
      .eq('text_hash', textHash)
      .eq('source_language', sourceLang)
      .eq('target_language', targetLang)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Increment hit count
    await this.db
      .from('translation_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('id', data.id);

    return data;
  }

  /**
   * Save a translation to the cache.
   * @param {string} text - Original text
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {string} translatedText
   * @param {string} provider
   * @param {number} [ttlHours=720]
   * @returns {Promise<object>}
   */
  static async saveToCache(text, sourceLang, targetLang, translatedText, provider, ttlHours = 720) {
    const textHash = crypto.createHash('sha256').update(text).digest('hex');
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    const { data, error } = await this.db
      .from('translation_cache')
      .upsert(
        {
          text_hash: textHash,
          source_language: sourceLang,
          target_language: targetLang,
          translated_text: translatedText,
          provider,
          hit_count: 0,
          expires_at: expiresAt,
        },
        { onConflict: 'text_hash,source_language,target_language' },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Config helpers ────────────────────────────────────────────────────────

  /**
   * Get a translation config value by key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  static async getConfig(key) {
    const { data, error } = await this.db
      .from('translation_config')
      .select('value, is_encrypted')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  }

  /**
   * Get all translation config entries.
   * Encrypted values are masked.
   * @returns {Promise<object[]>}
   */
  static async getAllConfig() {
    const { data, error } = await this.db
      .from('translation_config')
      .select('*')
      .order('key', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      value: row.is_encrypted && row.value ? MASKED_VALUE : row.value,
    }));
  }

  /**
   * Get all config as a key→value map (unmasked, for internal use).
   * @returns {Promise<Record<string, string>>}
   */
  static async getConfigMap() {
    const { data, error } = await this.db
      .from('translation_config')
      .select('key, value');
    if (error) throw error;
    const map = {};
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    return map;
  }

  /**
   * Update a translation config entry.
   * @param {string} key
   * @param {string} value
   * @param {string} [updatedBy]
   * @returns {Promise<object>}
   */
  static async setConfig(key, value, updatedBy) {
    const { data, error } = await this.db
      .from('translation_config')
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('key', key)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Bulk update translation config.
   * @param {Record<string, string>} updates - key/value pairs
   * @param {string} [updatedBy]
   * @returns {Promise<object[]>}
   */
  static async bulkSetConfig(updates, updatedBy) {
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        const result = await this.setConfig(key, value, updatedBy);
        results.push(result);
      }
    }
    return results;
  }
}
