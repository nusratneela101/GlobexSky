/**
 * Chat Translation Service — Multi-provider translation with caching & fallback.
 *
 * Providers: Google Translate, DeepL, OpenAI, Azure Translator, LibreTranslate
 * All API keys are loaded from DB (translation_config table), NOT from .env.
 */

import crypto from 'crypto';
import ChatTranslation from '../models/ChatTranslation.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LIBRE_URL = 'https://libretranslate.de';
const DEEPL_FREE_API_URL = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO_API_URL = 'https://api.deepl.com/v2/translate';

// ─── Language metadata ───────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  en: 'English', zh: 'Chinese', ar: 'Arabic', es: 'Spanish',
  fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean',
  pt: 'Portuguese', ru: 'Russian', hi: 'Hindi', bn: 'Bengali',
  it: 'Italian', nl: 'Dutch', tr: 'Turkish', vi: 'Vietnamese',
  th: 'Thai', pl: 'Polish', sv: 'Swedish', id: 'Indonesian',
};

// Regex-based language detection patterns
const LANGUAGE_PATTERNS = [
  { lang: 'ar', re: /[\u0600-\u06FF]/ },
  { lang: 'zh', re: /[\u4E00-\u9FFF]/ },
  { lang: 'ja', re: /[\u3040-\u30FF]/ },
  { lang: 'ko', re: /[\uAC00-\uD7AF]/ },
  { lang: 'ru', re: /[\u0400-\u04FF]/ },
  { lang: 'hi', re: /[\u0900-\u097F]/ },
  { lang: 'bn', re: /[\u0980-\u09FF]/ },
  { lang: 'th', re: /[\u0E00-\u0E7F]/ },
  { lang: 'de', re: /\b(und|der|die|das|ein|ist|nicht)\b/i },
  { lang: 'fr', re: /\b(le|la|les|un|une|des|est|dans)\b/i },
  { lang: 'es', re: /\b(el|la|los|las|un|una|es|en)\b/i },
  { lang: 'pt', re: /\b(o|a|os|as|um|uma|não|em)\b/i },
  { lang: 'it', re: /\b(il|la|i|le|un|una|che|di)\b/i },
];

// ─── Config cache (refreshed periodically) ──────────────────────────────────

let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

async function getConfig() {
  if (_configCache && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache;
  }
  try {
    _configCache = await ChatTranslation.getConfigMap();
    _configCacheTime = Date.now();
  } catch {
    _configCache = _configCache || {};
  }
  return _configCache;
}

/** Force-refresh config cache (e.g. after admin update). */
export function invalidateConfigCache() {
  _configCache = null;
  _configCacheTime = 0;
}

// ─── Provider implementations ───────────────────────────────────────────────

/**
 * Google Cloud Translation API v2.
 */
async function googleTranslate(text, sourceLang, targetLang, apiKey) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const body = {
    q: text,
    target: targetLang,
    format: 'text',
  };
  if (sourceLang && sourceLang !== 'auto') body.source = sourceLang;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Google Translate API error');
  const t = json.data?.translations?.[0];
  return {
    translatedText: t?.translatedText || '',
    detectedLanguage: t?.detectedSourceLanguage || sourceLang,
    confidence: 0.95,
  };
}

/**
 * DeepL API.
 */
async function deeplTranslate(text, sourceLang, targetLang, apiKey) {
  // DeepL free API keys end with ':fx'; fall back to pro endpoint otherwise
  const url = apiKey.endsWith(':fx') ? DEEPL_FREE_API_URL : DEEPL_PRO_API_URL;

  const params = new URLSearchParams();
  params.append('text', text);
  params.append('target_lang', targetLang.toUpperCase());
  if (sourceLang && sourceLang !== 'auto') params.append('source_lang', sourceLang.toUpperCase());

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'DeepL API error');
  const t = json.translations?.[0];
  return {
    translatedText: t?.text || '',
    detectedLanguage: t?.detected_source_language?.toLowerCase() || sourceLang,
    confidence: 0.97,
  };
}

/**
 * OpenAI Chat Completions — translation via GPT.
 */
async function openaiTranslate(text, sourceLang, targetLang, apiKey) {
  const sourceLabel = LANGUAGE_NAMES[sourceLang] || sourceLang;
  const targetLabel = LANGUAGE_NAMES[targetLang] || targetLang;
  const prompt =
    sourceLang === 'auto'
      ? `Translate the following text to ${targetLabel}. Only return the translated text, nothing else.\n\nText: ${text}`
      : `Translate the following text from ${sourceLabel} to ${targetLabel}. Only return the translated text, nothing else.\n\nText: ${text}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'OpenAI API error');
  return {
    translatedText: json.choices?.[0]?.message?.content?.trim() || '',
    detectedLanguage: sourceLang,
    confidence: 0.90,
  };
}

/**
 * Azure Cognitive Services Translator.
 */
async function azureTranslate(text, sourceLang, targetLang, apiKey, endpoint) {
  const baseUrl = endpoint || 'https://api.cognitive.microsofttranslator.com';
  const url = `${baseUrl}/translate?api-version=3.0&to=${targetLang}${sourceLang && sourceLang !== 'auto' ? `&from=${sourceLang}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ Text: text }]),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Azure Translator API error');
  const t = json[0]?.translations?.[0];
  return {
    translatedText: t?.text || '',
    detectedLanguage: json[0]?.detectedLanguage?.language || sourceLang,
    confidence: json[0]?.detectedLanguage?.score || 0.95,
  };
}

/**
 * LibreTranslate (self-hosted or public instance).
 */
async function libreTranslate(text, sourceLang, targetLang, _apiKey, libreUrl) {
  const url = `${libreUrl || DEFAULT_LIBRE_URL}/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLang === 'auto' ? 'auto' : sourceLang,
      target: targetLang,
      format: 'text',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'LibreTranslate API error');
  return {
    translatedText: json.translatedText || '',
    detectedLanguage: json.detectedLanguage?.language || sourceLang,
    confidence: json.detectedLanguage?.confidence || 0.80,
  };
}

// ─── Provider dispatcher ────────────────────────────────────────────────────

const PROVIDERS = {
  google: googleTranslate,
  deepl: deeplTranslate,
  openai: openaiTranslate,
  azure: azureTranslate,
  libre: libreTranslate,
};

/**
 * Call a specific provider.
 */
async function callProvider(provider, text, sourceLang, targetLang, config) {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);

  const keyMap = {
    google: 'google_translate_api_key',
    deepl: 'deepl_api_key',
    openai: 'openai_api_key',
    azure: 'azure_translator_key',
    libre: 'libre_translate_url',
  };

  const apiKey = config[keyMap[provider]] || '';
  if (!apiKey && provider !== 'libre') {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  const extra = provider === 'azure'
    ? config.azure_translator_endpoint
    : provider === 'libre'
      ? config.libre_translate_url
      : undefined;

  return fn(text, sourceLang, targetLang, apiKey, extra);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Translate text using configured providers with caching & fallback.
 *
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code or 'auto'
 * @param {string} targetLang - Target language code
 * @param {string} [providerOverride] - Force a specific provider
 * @returns {Promise<{success: boolean, translatedText?: string, sourceLang?: string, targetLang: string, provider?: string, cached?: boolean, confidence?: number, processingTime?: number, error?: string}>}
 */
export async function translateText(text, sourceLang, targetLang, providerOverride) {
  const startTime = Date.now();
  const config = await getConfig();

  // Check feature status
  if (config.feature_enabled !== 'true') {
    return { success: false, error: 'Translation feature is disabled' };
  }

  // Validate text length
  const maxLen = parseInt(config.max_text_length, 10) || 5000;
  if (text.length > maxLen) {
    return { success: false, error: `Text exceeds maximum length of ${maxLen} characters` };
  }

  // Skip translation if source === target
  if (sourceLang && sourceLang !== 'auto' && sourceLang === targetLang) {
    return {
      success: true,
      translatedText: text,
      sourceLang,
      targetLang,
      provider: 'none',
      cached: false,
      confidence: 1.0,
      processingTime: Date.now() - startTime,
    };
  }

  // Check cache
  if (config.cache_enabled === 'true') {
    try {
      const cached = await ChatTranslation.getCached(text, sourceLang || 'auto', targetLang);
      if (cached) {
        return {
          success: true,
          translatedText: cached.translated_text,
          sourceLang: cached.source_language,
          targetLang: cached.target_language,
          provider: cached.provider,
          cached: true,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }
    } catch {
      // Cache miss — proceed to translate
    }
  }

  // Build provider chain
  const primaryProvider = providerOverride || config.primary_provider || 'google';
  const fallbackStr = config.fallback_chain || 'google,deepl,openai,azure,libre';
  const allProviders = fallbackStr.split(',').map((p) => p.trim());
  const chain = [primaryProvider, ...allProviders.filter((p) => p !== primaryProvider)];

  let lastError = null;
  for (const provider of chain) {
    try {
      const result = await callProvider(provider, text, sourceLang || 'auto', targetLang, config);

      // Save to cache
      if (config.cache_enabled === 'true') {
        const ttl = parseInt(config.cache_ttl_hours, 10) || 720;
        try {
          await ChatTranslation.saveToCache(
            text,
            result.detectedLanguage || sourceLang || 'auto',
            targetLang,
            result.translatedText,
            provider,
            ttl,
          );
        } catch {
          // Cache save failure is non-critical
        }
      }

      return {
        success: true,
        translatedText: result.translatedText,
        sourceLang: result.detectedLanguage || sourceLang || 'auto',
        targetLang,
        provider,
        cached: false,
        confidence: result.confidence || 0,
        processingTime: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err;
      // Continue to next provider in fallback chain
    }
  }

  return {
    success: false,
    error: lastError?.message || 'All translation providers failed',
    processingTime: Date.now() - startTime,
  };
}

/**
 * Detect the language of text.
 * @param {string} text
 * @returns {Promise<{success: boolean, language?: string, confidence?: number, error?: string}>}
 */
export async function detectLanguage(text) {
  if (!text || !text.trim()) {
    return { success: false, error: 'No text provided for language detection' };
  }

  const config = await getConfig();

  // Try regex-based detection first (fast, no API call)
  for (const { lang, re } of LANGUAGE_PATTERNS) {
    if (re.test(text)) {
      return { success: true, language: lang, confidence: 0.85, method: 'pattern' };
    }
  }

  // Try provider-based detection if configured
  const provider = config.primary_provider || 'google';
  try {
    if (provider === 'google' && config.google_translate_api_key) {
      const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${encodeURIComponent(config.google_translate_api_key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      });
      const json = await res.json();
      if (res.ok) {
        const d = json.data?.detections?.[0]?.[0];
        if (d) return { success: true, language: d.language, confidence: d.confidence, method: 'google' };
      }
    }

    if (provider === 'openai' && config.openai_api_key) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Detect the language of the following text. Return only the ISO 639-1 language code (e.g., 'en', 'fr', 'zh').\n\nText: ${text}`,
            },
          ],
          temperature: 0,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const lang = json.choices?.[0]?.message?.content?.trim().toLowerCase();
        if (lang && lang.length <= 5) return { success: true, language: lang, confidence: 0.9, method: 'openai' };
      }
    }
  } catch {
    // Fall through to default
  }

  return { success: true, language: 'en', confidence: 0.5, method: 'default' };
}

/**
 * Get list of supported languages from config.
 * @returns {Promise<{code: string, name: string}[]>}
 */
export async function getSupportedLanguages() {
  const config = await getConfig();
  const codes = (config.supported_languages || 'en').split(',').map((c) => c.trim());
  return codes.map((code) => ({ code, name: LANGUAGE_NAMES[code] || code }));
}

/**
 * Test a provider connection by translating a sample phrase.
 * @param {string} provider
 * @param {Record<string,string>} [configOverrides] - temporary config for testing
 * @returns {Promise<{success: boolean, translatedText?: string, provider: string, processingTime: number, error?: string}>}
 */
export async function testProviderConnection(provider, configOverrides = {}) {
  const startTime = Date.now();
  const testText = 'Hello, how are you?';
  const testTarget = 'es';

  try {
    const config = { ...(await getConfig()), ...configOverrides };
    const result = await callProvider(provider, testText, 'en', testTarget, config);

    return {
      success: true,
      translatedText: result.translatedText,
      provider,
      processingTime: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      provider,
      processingTime: Date.now() - startTime,
    };
  }
}
