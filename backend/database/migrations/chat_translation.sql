-- ============================================================================
-- Chat Translation System — Database Migration
-- Tables: chat_translations, translation_cache, translation_config
-- ============================================================================

-- 1. Chat Translations — stores translated messages
CREATE TABLE IF NOT EXISTS chat_translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'google',
  confidence    NUMERIC(5,4) DEFAULT 0.0000,
  cached        BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_translations_message_id ON chat_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_translations_languages ON chat_translations(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_chat_translations_provider ON chat_translations(provider);

-- 2. Translation Cache — hash-based translation caching for performance
CREATE TABLE IF NOT EXISTS translation_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash       TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'google',
  hit_count       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '720 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache(text_hash, source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);

-- 3. Translation Config — admin-managed key-value configuration
CREATE TABLE IF NOT EXISTS translation_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_config_key ON translation_config(key);

-- 4. Default configuration values
INSERT INTO translation_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',         'false',  'Enable/disable chat translation feature', FALSE),
  ('mode',                    'test',   'Operating mode: test or live', FALSE),
  ('primary_provider',        'google', 'Primary translation provider (google, deepl, openai, azure, libre)', FALSE),
  ('google_translate_api_key','',       'Google Cloud Translation API key', TRUE),
  ('deepl_api_key',           '',       'DeepL API key', TRUE),
  ('openai_api_key',          '',       'OpenAI API key for translation', TRUE),
  ('azure_translator_key',    '',       'Azure Cognitive Services Translator key', TRUE),
  ('azure_translator_endpoint','',      'Azure Translator endpoint URL', FALSE),
  ('libre_translate_url',     'https://libretranslate.de', 'LibreTranslate API URL', FALSE),
  ('auto_detect_language',    'true',   'Automatically detect source language', FALSE),
  ('default_target_language',  'en',    'Default target language for translations', FALSE),
  ('cache_enabled',           'true',   'Enable translation caching', FALSE),
  ('cache_ttl_hours',         '720',    'Cache time-to-live in hours', FALSE),
  ('max_text_length',         '5000',   'Maximum text length for translation', FALSE),
  ('supported_languages',     'en,zh,ar,es,fr,de,ja,ko,pt,ru,hi,bn', 'Comma-separated list of supported language codes', FALSE),
  ('fallback_chain',          'google,deepl,openai,azure,libre', 'Provider fallback order', FALSE)
ON CONFLICT (key) DO NOTHING;
