/**
 * Chat Translation WebSocket Service
 *
 * Provides real-time translation on incoming chat messages.
 * Auto-translates based on each user's preferred language.
 * Integrates with existing Socket.IO chat namespace.
 */

import { translateText, detectLanguage } from './translation.service.js';
import ChatTranslation from '../models/ChatTranslation.js';

/**
 * Initialize chat translation WebSocket handlers.
 * Call this after initializeWebSocket(io) in server.js.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function initializeChatTranslation(io) {
  const chatNs = io.of('/chat');

  // Track user language preferences per socket
  const userLanguages = new Map();

  chatNs.on('connection', (socket) => {
    // ─── Set preferred language ───────────────────────────────────────
    socket.on('translation:set-language', (data) => {
      const { language } = data || {};
      if (language && typeof language === 'string') {
        userLanguages.set(socket.id, language.toLowerCase());
        socket.emit('translation:language-set', { language: language.toLowerCase() });
      }
    });

    // ─── Request translation of a message ─────────────────────────────
    socket.on('translation:translate', async (data) => {
      const { messageId, text, targetLanguage, sourceLanguage } = data || {};

      if (!text || !targetLanguage) {
        socket.emit('translation:error', {
          messageId,
          error: 'text and targetLanguage are required',
        });
        return;
      }

      try {
        const result = await translateText(
          text,
          sourceLanguage || 'auto',
          targetLanguage,
        );

        if (result.success) {
          // Store translation if messageId provided
          if (messageId) {
            try {
              await ChatTranslation.translate({
                message_id: messageId,
                original_text: text,
                translated_text: result.translatedText,
                source_language: result.sourceLang || sourceLanguage || 'auto',
                target_language: targetLanguage,
                provider: result.provider,
                confidence: result.confidence || 0,
                cached: result.cached || false,
                processing_time_ms: result.processingTime || 0,
              });
            } catch {
              // Non-critical storage failure
            }
          }

          socket.emit('translation:result', {
            messageId,
            originalText: text,
            translatedText: result.translatedText,
            sourceLang: result.sourceLang,
            targetLang: targetLanguage,
            provider: result.provider,
            cached: result.cached,
            confidence: result.confidence,
          });
        } else {
          socket.emit('translation:error', {
            messageId,
            error: result.error,
          });
        }
      } catch (err) {
        socket.emit('translation:error', {
          messageId,
          error: err.message || 'Translation failed',
        });
      }
    });

    // ─── Detect language of text ──────────────────────────────────────
    socket.on('translation:detect', async (data) => {
      const { text } = data || {};
      if (!text) {
        socket.emit('translation:detect-result', { error: 'text is required' });
        return;
      }

      try {
        const result = await detectLanguage(text);
        socket.emit('translation:detect-result', result);
      } catch (err) {
        socket.emit('translation:detect-result', {
          success: false,
          error: err.message,
        });
      }
    });

    // ─── Auto-translate incoming messages for user's preferred language ─
    socket.on('message:translate-auto', async (data) => {
      const { messageId, text, sourceLanguage } = data || {};
      const targetLang = userLanguages.get(socket.id);

      if (!targetLang || !text) return;

      // Skip if source is same as target
      if (sourceLanguage === targetLang) {
        socket.emit('translation:auto-result', {
          messageId,
          translatedText: text,
          skipped: true,
        });
        return;
      }

      try {
        const result = await translateText(text, sourceLanguage || 'auto', targetLang);
        if (result.success) {
          socket.emit('translation:auto-result', {
            messageId,
            originalText: text,
            translatedText: result.translatedText,
            sourceLang: result.sourceLang,
            targetLang,
            provider: result.provider,
            cached: result.cached,
          });
        }
      } catch (err) {
        console.warn('[ChatTranslation] Auto-translate failed:', err.message);
      }
    });

    // ─── Cleanup on disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
      userLanguages.delete(socket.id);
    });
  });
}
