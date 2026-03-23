/**
 * Globex Sky — OpenAI Client
 * Centralised OpenAI client with graceful degradation when the API key is absent.
 * All AI services import `openaiClient` (which may be null) and check before calling.
 *
 * Environment variable: OPENAI_API_KEY
 */

import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

/**
 * OpenAI client instance.  Will be `null` when OPENAI_API_KEY is not configured
 * so that callers can fall back to rule-based logic without throwing.
 * @type {OpenAI|null}
 */
const openaiClient = apiKey
  ? new OpenAI({ apiKey })
  : null;

if (!apiKey) {
  console.warn('[OpenAI] OPENAI_API_KEY is not set — AI features will use rule-based fallbacks.');
}

export default openaiClient;
