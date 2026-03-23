/**
 * Globex Sky — Chatbot Service
 * OpenAI GPT-3.5-turbo integration with graceful rule-based fallback.
 * Uses OPENAI_API_KEY env var — never hardcoded.
 */

import supabase from '../config/supabase.js';
import openaiClient from '../config/openai.js';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are GlobexSky's helpful shopping assistant for an international B2B/B2C trade platform.
Help users with: product searches, order status, returns/refunds, shipping, payments, and account queries.
Be concise, friendly, and professional. If you cannot help, say so and offer to escalate to a human agent.
Always respond in the same language the user writes in.`;

/**
 * Intent categories for classification.
 */
const INTENT_PATTERNS = {
  order_status: [/order status/i, /where is my order/i, /track.*order/i, /order.*track/i, /my order/i, /order #/i, /order number/i],
  shipping_info: [/shipping/i, /delivery time/i, /how long.*deliver/i, /when.*arrive/i, /transit/i, /estimated.*delivery/i],
  return_refund: [/return/i, /refund/i, /exchange/i, /cancel.*order/i, /money back/i, /send.*back/i],
  product_inquiry: [/product/i, /available/i, /in stock/i, /price/i, /quality/i, /specification/i, /detail/i],
  payment_issue: [/payment/i, /charge/i, /invoice/i, /billing/i, /transaction/i, /pay/i],
  account_help: [/account/i, /password/i, /login/i, /sign in/i, /register/i, /profile/i],
  general_faq: [/how/i, /what/i, /when/i, /where/i, /help/i, /support/i, /contact/i],
};

/**
 * Default response templates.
 */
const DEFAULT_RESPONSES = {
  order_status: 'To check your order status, please go to My Account → Orders, or provide your order number and I can look it up for you.',
  shipping_info: 'Standard shipping takes 7-14 business days. Express shipping (3-5 days) is also available at checkout. You can track your shipment in real time using the tracking number sent to your email.',
  return_refund: 'We offer a 30-day return policy. To initiate a return, go to My Account → Orders → Select the order → Request Return. Refunds are processed within 5-7 business days.',
  product_inquiry: 'I can help you with product information! Please provide the product name or SKU, and I will find the details for you.',
  payment_issue: 'For payment issues, please check your bank statement first. If the charge appears incorrect, contact us and we will resolve it within 24 hours.',
  account_help: 'For account assistance, you can reset your password from the login page by clicking "Forgot Password". If you have further issues, our support team is here to help.',
  general_faq: 'I am happy to help! Could you please provide more details about your question so I can give you the best answer?',
  fallback: "I'm sorry, I didn't quite understand your question. Let me connect you with a human agent who can assist you better. You can also browse our FAQ section for common questions.",
};

/**
 * Classify the intent of a user message.
 * @param {string} message
 * @returns {string} intent key
 */
export function classifyIntent(message) {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => p.test(message))) return intent;
  }
  return 'fallback';
}

/**
 * Generate a response using OpenAI GPT-3.5-turbo with conversation history.
 * Falls back to rule-based responses when OpenAI is unavailable.
 *
 * @param {string} userId
 * @param {string} message
 * @param {string|null} sessionId
 * @param {Array<{role:string,content:string}>} conversationHistory - last N messages
 * @returns {{ session_id, intent, response, should_escalate, needs_human, suggested_products }}
 */
export async function generateBotResponse(userId, message, sessionId = null, conversationHistory = []) {
  const intent = classifyIntent(message);
  const sid = sessionId || `${userId}-${Date.now()}`;

  let responseText;
  let shouldEscalate = false;
  let needsHuman = false;
  const suggestedProducts = [];

  // ── 1. Try OpenAI ──────────────────────────────────────────────────────────
  if (openaiClient) {
    try {
      // Keep last 10 exchanges as context
      const historyMessages = conversationHistory.slice(-10).map((m) => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content,
      }));

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...historyMessages,
          { role: 'user', content: message },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      responseText = completion.choices[0]?.message?.content?.trim()
        || DEFAULT_RESPONSES.fallback;

      // Detect low-confidence / escalation signals
      const lcResp = responseText.toLowerCase();
      if (
        lcResp.includes('human agent') ||
        lcResp.includes('support team') ||
        lcResp.includes('i cannot') ||
        lcResp.includes("i'm unable")
      ) {
        needsHuman = true;
        shouldEscalate = true;
      }
    } catch (err) {
      console.warn('[Chatbot] OpenAI call failed, using fallback:', err.message);
      // Fall through to rule-based
    }
  }

  // ── 2. Rule-based fallback ─────────────────────────────────────────────────
  if (!responseText) {
    const { data: customQA } = await supabase
      .from('chatbot_qa')
      .select('*')
      .ilike('question_pattern', `%${message.substring(0, 50)}%`)
      .limit(1)
      .maybeSingle();

    responseText = customQA?.answer || DEFAULT_RESPONSES[intent] || DEFAULT_RESPONSES.fallback;
    shouldEscalate = intent === 'fallback' && !customQA;
    needsHuman = shouldEscalate;
  }

  // ── 3. Persist conversation ────────────────────────────────────────────────
  await supabase.from('chatbot_messages').insert([
    { session_id: sid, user_id: userId, role: 'user', content: message },
    { session_id: sid, user_id: userId, role: 'bot', content: responseText, intent },
  ]);

  return {
    session_id: sid,
    intent,
    response: responseText,
    should_escalate: shouldEscalate,
    needs_human: needsHuman,
    suggested_products: suggestedProducts,
  };
}

/**
 * Detect intent using OpenAI few-shot classification (falls back to regex).
 * @param {string} message
 * @returns {Promise<string>} intent key
 */
export async function detectIntent(message) {
  if (openaiClient) {
    try {
      const examples = [
        { msg: 'Where is my order?', intent: 'order_status' },
        { msg: 'How long does shipping take?', intent: 'shipping_info' },
        { msg: 'I want to return this item', intent: 'return_request' },
        { msg: 'What is the price of this product?', intent: 'price_inquiry' },
        { msg: 'I have a complaint', intent: 'complaint' },
        { msg: 'Can you help me?', intent: 'general_question' },
      ];
      const exampleText = examples.map((e) => `"${e.msg}" → ${e.intent}`).join('\n');
      const prompt = `Classify the following message into one of: product_search, order_status, return_request, general_question, complaint, price_inquiry, shipping_info.\n\nExamples:\n${exampleText}\n\n"${message}" →`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0,
      });

      const raw = completion.choices[0]?.message?.content?.trim().toLowerCase() || '';
      const validIntents = ['product_search', 'order_status', 'return_request', 'general_question', 'complaint', 'price_inquiry', 'shipping_info'];
      const found = validIntents.find((i) => raw.includes(i));
      if (found) return found;
    } catch (_err) {
      // Fallback below
    }
  }
  return classifyIntent(message);
}

/**
 * Generate an SEO-optimized product description using OpenAI.
 * Falls back to a template description when OpenAI is unavailable.
 *
 * @param {{ name: string, category: string, attributes: object }} productData
 * @param {'professional'|'casual'|'engaging'} tone
 * @returns {Promise<string>}
 */
export async function generateProductDescription(productData, tone = 'engaging') {
  const { name, category, attributes = {} } = productData;
  const attrText = Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ');

  if (openaiClient) {
    try {
      const prompt = `Write a ${tone} SEO-optimized product description for an e-commerce listing.\nProduct: ${name}\nCategory: ${category}\nAttributes: ${attrText}\nKeep it under 150 words. Highlight key benefits and include a call to action.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.8,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (_err) {
      // Fall through
    }
  }

  // Fallback template
  return `${name} — a high-quality ${category} product. ${attrText ? `Features: ${attrText}.` : ''} Perfect for buyers seeking reliability and value. Order today for fast international shipping.`;
}

/**
 * Summarise a list of reviews into key pros/cons with sentiment breakdown.
 * Falls back to a simple count when OpenAI is unavailable.
 *
 * @param {Array<{rating: number, comment: string}>} reviews
 * @returns {Promise<{ summary: string, pros: string[], cons: string[], sentiment: { positive: number, neutral: number, negative: number } }>}
 */
export async function summarizeReviews(reviews) {
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const neutral = reviews.length - positive - negative;

  const sentiment = {
    positive: reviews.length ? Math.round((positive / reviews.length) * 100) : 0,
    neutral: reviews.length ? Math.round((neutral / reviews.length) * 100) : 0,
    negative: reviews.length ? Math.round((negative / reviews.length) * 100) : 0,
  };

  if (openaiClient && reviews.length > 0) {
    try {
      const sampleComments = reviews.slice(0, 50).map((r) => `[${r.rating}★] ${r.comment}`).join('\n');
      const prompt = `Summarise these product reviews into: a 2-sentence summary, 3 pros, and 3 cons.\nFormat:\nSUMMARY: ...\nPROS: item1 | item2 | item3\nCONS: item1 | item2 | item3\n\nReviews:\n${sampleComments}`;

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

      return {
        summary: summaryMatch?.[1]?.trim() || 'No summary available.',
        pros: prosMatch?.[1]?.split('|').map((s) => s.trim()).filter(Boolean) || [],
        cons: consMatch?.[1]?.split('|').map((s) => s.trim()).filter(Boolean) || [],
        sentiment,
      };
    } catch (_err) {
      // Fall through
    }
  }

  // Fallback
  return {
    summary: `Based on ${reviews.length} reviews with ${sentiment.positive}% positive feedback.`,
    pros: positive > 0 ? ['Good quality', 'Fast delivery', 'Value for money'] : [],
    cons: negative > 0 ? ['Some quality concerns', 'Delivery delays reported'] : [],
    sentiment,
  };
}

/**
 * Translate text to a target language using OpenAI.
 * Supported: en, bn, ar, hi, zh, fr, es.
 * Falls back to returning the original text with a note.
 *
 * @param {string} text
 * @param {string} targetLanguage - BCP-47 language code
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLanguage) {
  const SUPPORTED = ['en', 'bn', 'ar', 'hi', 'zh', 'fr', 'es'];
  if (!SUPPORTED.includes(targetLanguage)) {
    throw new Error(`Unsupported language: ${targetLanguage}. Supported: ${SUPPORTED.join(', ')}`);
  }
  if (targetLanguage === 'en') return text;

  if (openaiClient) {
    try {
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `Translate the following text to ${targetLanguage}. Return only the translation, nothing else:\n\n${text}`,
          },
        ],
        max_tokens: Math.max(text.length * 2, 200),
        temperature: 0.3,
      });
      return completion.choices[0]?.message?.content?.trim() || text;
    } catch (_err) {
      // Fall through
    }
  }
  return text;
}

/**
 * Get conversation history for a user.
 * @param {string} userId
 * @param {number} limit
 */
export async function getChatHistory(userId, limit = 50) {
  const { data, error } = await supabase
    .from('chatbot_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}

/**
 * Clear chat history for a user.
 * @param {string} userId
 */
export async function clearChatHistory(userId) {
  const { error } = await supabase
    .from('chatbot_messages')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get most frequently asked questions based on intent patterns.
 */
export async function getPopularQuestionsData() {
  // Return the top custom Q&A pairs
  const { data: customQA } = await supabase
    .from('chatbot_qa')
    .select('id, question_pattern, answer, usage_count')
    .order('usage_count', { ascending: false })
    .limit(10);

  const faqs = (customQA || []).length > 0
    ? customQA
    : Object.entries(DEFAULT_RESPONSES)
        .filter(([k]) => k !== 'fallback')
        .map(([intent, answer]) => ({
          intent,
          question: intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          answer,
        }));

  return faqs;
}

/**
 * Train the chatbot with a custom Q&A pair.
 * @param {string} questionPattern
 * @param {string} answer
 * @param {string} intent
 */
export async function trainCustomResponse(questionPattern, answer, intent = 'general_faq') {
  const { data, error } = await supabase
    .from('chatbot_qa')
    .upsert([{ question_pattern: questionPattern, answer, intent, usage_count: 0 }], {
      onConflict: 'question_pattern',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get chatbot analytics data.
 * @param {{ start?: string, end?: string }} range
 */
export async function getChatbotAnalyticsData({ start, end } = {}) {
  let query = supabase
    .from('chatbot_messages')
    .select('role, intent, session_id, created_at');

  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  const messages = data || [];
  const sessions = new Set(messages.map(m => m.session_id));
  const botMessages = messages.filter(m => m.role === 'bot');
  const escalations = botMessages.filter(m => m.intent === 'fallback');

  const intentCounts = botMessages.reduce((acc, m) => {
    if (m.intent) acc[m.intent] = (acc[m.intent] || 0) + 1;
    return acc;
  }, {});

  const avgMessagesPerSession = sessions.size > 0
    ? +(messages.length / sessions.size).toFixed(1)
    : 0;

  return {
    total_messages: messages.length,
    total_sessions: sessions.size,
    escalation_count: escalations.length,
    escalation_rate: sessions.size > 0
      ? +((escalations.length / sessions.size) * 100).toFixed(1)
      : 0,
    avg_messages_per_session: avgMessagesPerSession,
    intent_breakdown: intentCounts,
  };
}
