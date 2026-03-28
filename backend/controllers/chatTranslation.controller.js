/**
 * Chat Translation Controller
 * Handles translate, detect, languages, config CRUD, and provider testing.
 */

import ChatTranslation from '../models/ChatTranslation.js';
import {
  translateText,
  detectLanguage,
  getSupportedLanguages,
  testProviderConnection,
  invalidateConfigCache,
} from '../services/translation.service.js';

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

// ─── POST /api/v1/translation/translate ─────────────────────────────────────

/** Translate text. */
export async function translate(req, res, next) {
  try {
    const { text, source_language, target_language, provider, message_id } = req.body;

    if (!text) return sendError(res, 400, 'text is required');
    if (!target_language) return sendError(res, 400, 'target_language is required');

    const result = await translateText(
      text,
      source_language || 'auto',
      target_language,
      provider,
    );

    if (!result.success) {
      return sendError(res, 422, result.error);
    }

    // If message_id is provided, store the translation record
    if (message_id && result.translatedText) {
      try {
        await ChatTranslation.translate({
          message_id,
          original_text: text,
          translated_text: result.translatedText,
          source_language: result.sourceLang || source_language || 'auto',
          target_language,
          provider: result.provider,
          confidence: result.confidence || 0,
          cached: result.cached || false,
          processing_time_ms: result.processingTime || 0,
        });
      } catch {
        // Storage failure is non-critical
      }
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/translation/detect ────────────────────────────────────────

/** Detect language of text. */
export async function detect(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return sendError(res, 400, 'text is required');

    const result = await detectLanguage(text);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/translation/languages ──────────────────────────────────────

/** List supported languages. */
export async function languages(_req, res, next) {
  try {
    const data = await getSupportedLanguages();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/translation/config ─────────────────────────────────────────

/** Admin: get all translation config (encrypted values masked). */
export async function getConfig(_req, res, next) {
  try {
    const data = await ChatTranslation.getAllConfig();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/v1/translation/config ─────────────────────────────────────────

/** Admin: update translation config. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return sendError(res, 400, 'Request body must be a config object');
    }

    const userId = req.user?.id || null;
    const results = await ChatTranslation.bulkSetConfig(updates, userId);

    // Invalidate service-level config cache
    invalidateConfigCache();

    return res.json({ success: true, data: results, message: 'Configuration updated' });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/translation/config/test ───────────────────────────────────

/** Admin: test a provider connection. */
export async function testConnection(req, res, next) {
  try {
    const { provider, ...configOverrides } = req.body;
    if (!provider) return sendError(res, 400, 'provider is required');

    const validProviders = ['google', 'deepl', 'openai', 'azure', 'libre'];
    if (!validProviders.includes(provider)) {
      return sendError(res, 400, `Invalid provider. Valid: ${validProviders.join(', ')}`);
    }

    const result = await testProviderConnection(provider, configOverrides);
    return res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/translation/history/:messageId ─────────────────────────────

/** Get translations for a specific message. */
export async function getTranslationHistory(req, res, next) {
  try {
    const { messageId } = req.params;
    const { target_language } = req.query;

    if (target_language) {
      const data = await ChatTranslation.getTranslation(messageId, target_language);
      return res.json({ success: true, data });
    }

    // Get all translations for message
    const { data, error } = await ChatTranslation.db
      .from('chat_translations')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
