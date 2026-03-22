/**
 * Globex Sky — AI Chatbot Enhancement Service
 * Enhanced FAQ matching with fuzzy matching, context-aware responses,
 * product/order inquiry handling, escalation, multi-language support,
 * training data management, and conversation analytics.
 */

import supabase from '../../config/supabase.js';

// ─── Intent Patterns ──────────────────────────────────────────────────────────

const INTENT_PATTERNS = {
  order_status: [/order status/i, /where is my order/i, /track.*order/i, /order.*track/i, /my order/i, /order #/i, /order number/i, /order.*(\w{6,})/i],
  shipping_info: [/shipping/i, /delivery time/i, /how long.*deliver/i, /when.*arrive/i, /transit/i, /estimated.*delivery/i],
  return_refund: [/return/i, /refund/i, /exchange/i, /cancel.*order/i, /money back/i, /send.*back/i],
  product_inquiry: [/product/i, /available/i, /in stock/i, /price of/i, /quality/i, /specification/i, /detail/i, /tell me about/i],
  payment_issue: [/payment/i, /charge/i, /invoice/i, /billing/i, /transaction/i, /pay/i],
  account_help: [/account/i, /password/i, /login/i, /sign in/i, /register/i, /profile/i],
  escalate: [/human/i, /agent/i, /speak.*someone/i, /real person/i, /support team/i, /complaint/i],
  general_faq: [/how/i, /what/i, /when/i, /where/i, /help/i, /support/i, /contact/i],
};

const DEFAULT_RESPONSES = {
  order_status: 'To check your order status, please go to My Account → Orders, or share your order number and I\'ll look it up.',
  shipping_info: 'Standard shipping takes 7–14 business days. Express shipping (3–5 days) is available at checkout. Track your shipment using the tracking number sent to your email.',
  return_refund: 'We have a 30-day return policy. Go to My Account → Orders → Select Order → Request Return. Refunds process in 5–7 business days.',
  product_inquiry: 'I can help with product information! Please share the product name or SKU and I\'ll find the details.',
  payment_issue: 'For payment issues, check your bank statement first. If a charge seems incorrect, contact us and we\'ll resolve it within 24 hours.',
  account_help: 'To reset your password, click "Forgot Password" on the login page. For further issues, our support team is ready to help.',
  escalate: 'I\'m connecting you with a human support agent. They will assist you shortly. Thank you for your patience.',
  general_faq: 'Happy to help! Could you share more details about your question so I can give the best answer?',
  fallback: 'I\'m sorry, I didn\'t fully understand that. Let me connect you with a human agent. You can also browse our FAQ section.',
};

// Escalation confidence threshold (intent must score below this to escalate)
const ESCALATION_CONFIDENCE_THRESHOLD = 0.4;

// ─── Fuzzy Matching ───────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy-match a message against FAQ entries.
 * @param {string} message
 * @param {Array<{question_pattern: string, answer: string}>} faqs
 * @returns {{ faq: object|null, confidence: number }}
 */
function fuzzyMatchFAQ(message, faqs) {
  const msgLower = message.toLowerCase();
  let bestFAQ = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const pattern = faq.question_pattern.toLowerCase();
    // Exact substring match = high confidence
    if (msgLower.includes(pattern) || pattern.includes(msgLower.substring(0, 30))) {
      return { faq, confidence: 0.95 };
    }
    // Fuzzy: compute normalized similarity
    const dist = levenshtein(msgLower.substring(0, pattern.length), pattern);
    const maxLen = Math.max(msgLower.length, pattern.length, 1);
    const similarity = 1 - dist / maxLen;
    if (similarity > bestScore) {
      bestScore = similarity;
      bestFAQ = faq;
    }
  }

  return { faq: bestFAQ, confidence: bestScore };
}

/**
 * Classify the intent of a user message.
 * @param {string} message
 * @returns {{ intent: string, confidence: number }}
 */
function classifyIntent(message) {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some((p) => p.test(message))) {
      return { intent, confidence: 0.85 };
    }
  }
  return { intent: 'fallback', confidence: 0.1 };
}

// ─── Context Store (in-memory, keyed by session_id) ───────────────────────────

const conversationContext = new Map();

function getContext(sessionId) {
  return conversationContext.get(sessionId) || { messages: [], lastIntent: null, turnCount: 0 };
}

function updateContext(sessionId, intent, message) {
  const ctx = getContext(sessionId);
  ctx.messages = [...ctx.messages.slice(-9), message]; // keep last 10
  ctx.lastIntent = intent;
  ctx.turnCount += 1;
  conversationContext.set(sessionId, ctx);
  return ctx;
}

// ─── Product Inquiry Handling ─────────────────────────────────────────────────

async function handleProductInquiry(message) {
  // Try to extract a product name or SKU from the message
  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, average_rating, description')
    .eq('status', 'active')
    .ilike('title', `%${message.substring(0, 40)}%`)
    .limit(3);

  if (products?.length) {
    const p = products[0];
    return `Here's what I found: **${p.title}** — Price: $${p.price}, Rating: ${p.average_rating || 'N/A'}/5. ${p.description ? p.description.substring(0, 100) + '...' : ''}`;
  }
  return DEFAULT_RESPONSES.product_inquiry;
}

// ─── Order Status Handling ────────────────────────────────────────────────────

async function handleOrderStatus(message, userId) {
  // Try to extract order number from message
  const orderMatch = message.match(/\b([A-Z0-9]{6,})\b/i);
  if (orderMatch) {
    const orderId = orderMatch[1];
    // Use separate parameterized queries to avoid injection
    const { data: orderById } = await supabase
      .from('orders')
      .select('id, status, created_at, total_amount')
      .eq('id', orderId)
      .maybeSingle();

    const order = orderById || (await (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount')
        .eq('order_number', orderId)
        .maybeSingle();
      return data;
    })());

    if (order) {
      return `Order **${orderId}** — Status: **${order.status}**, Placed: ${new Date(order.created_at).toLocaleDateString()}, Total: $${order.total_amount}.`;
    }
  }

  // Show most recent order for user
  const { data: latestOrder } = await supabase
    .from('orders')
    .select('id, status, created_at, total_amount')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestOrder) {
    return `Your latest order (ID: **${latestOrder.id}**) — Status: **${latestOrder.status}**, Placed: ${new Date(latestOrder.created_at).toLocaleDateString()}, Total: $${latestOrder.total_amount}.`;
  }

  return DEFAULT_RESPONSES.order_status;
}

// ─── Multi-language Response Support ─────────────────────────────────────────

const TRANSLATIONS = {
  ar: { fallback: 'عذرًا، لم أفهم سؤالك. سأحولك إلى وكيل بشري.', greeting: 'مرحبًا! كيف يمكنني مساعدتك؟' },
  fr: { fallback: 'Désolé, je n\'ai pas compris. Je vous transfère à un agent.', greeting: 'Bonjour! Comment puis-je vous aider?' },
  es: { fallback: 'Lo siento, no entendí. Le transfiero a un agente.', greeting: '¡Hola! ¿Cómo puedo ayudarle?' },
  zh: { fallback: '对不起，我没有理解您的问题。我将为您转接人工客服。', greeting: '您好！我能为您提供什么帮助？' },
  de: { fallback: 'Entschuldigung, ich habe das nicht verstanden. Ich verbinde Sie mit einem Agenten.', greeting: 'Hallo! Wie kann ich Ihnen helfen?' },
};

function getLocalizedResponse(response, lang) {
  if (!lang || lang === 'en') return response;
  // In production, integrate with translation.service.js
  // For now, return English with a language note
  return response;
}

// ─── Main Bot Response ─────────────────────────────────────────────────────────

/**
 * Generate an enhanced bot response with context awareness.
 * @param {string} userId
 * @param {string} message
 * @param {string|null} sessionId
 * @param {string} lang - BCP-47 language code (default 'en')
 */
export async function generateEnhancedBotResponse(userId, message, sessionId = null, lang = 'en') {
  const sid = sessionId || `${userId}-${Date.now()}`;
  const ctx = updateContext(sid, null, message);

  // 1. Check custom Q&A with fuzzy matching
  const { data: allFAQs } = await supabase
    .from('chatbot_qa')
    .select('*')
    .order('usage_count', { ascending: false })
    .limit(50);

  const { faq, confidence } = fuzzyMatchFAQ(message, allFAQs || []);

  let responseText;
  let intent;
  let shouldEscalate = false;

  if (faq && confidence >= 0.6) {
    responseText = faq.answer;
    intent = faq.intent || 'custom_faq';
    // Increment usage count
    await supabase.from('chatbot_qa').update({ usage_count: (faq.usage_count || 0) + 1 }).eq('id', faq.id);
  } else {
    const classification = classifyIntent(message);
    intent = classification.intent;

    if (intent === 'escalate' || (intent === 'fallback' && ctx.turnCount > 3)) {
      shouldEscalate = true;
      responseText = getLocalizedResponse(DEFAULT_RESPONSES.escalate, lang);
    } else if (intent === 'product_inquiry') {
      responseText = await handleProductInquiry(message);
    } else if (intent === 'order_status') {
      responseText = await handleOrderStatus(message, userId);
    } else if (intent === 'fallback' && classification.confidence < ESCALATION_CONFIDENCE_THRESHOLD) {
      shouldEscalate = true;
      responseText = getLocalizedResponse(DEFAULT_RESPONSES.fallback, lang);
    } else {
      responseText = getLocalizedResponse(DEFAULT_RESPONSES[intent] || DEFAULT_RESPONSES.fallback, lang);
    }
  }

  updateContext(sid, intent, { role: 'bot', content: responseText });

  // Persist conversation
  await supabase.from('chatbot_messages').insert([
    { session_id: sid, user_id: userId, role: 'user', content: message, lang },
    { session_id: sid, user_id: userId, role: 'bot', content: responseText, intent, lang },
  ]);

  return {
    session_id: sid,
    intent,
    response: responseText,
    should_escalate: shouldEscalate,
    confidence: faq ? confidence : undefined,
    context_turn: ctx.turnCount,
  };
}

// ─── Training Data Management ─────────────────────────────────────────────────

/**
 * Create or update a FAQ entry.
 */
export async function upsertFAQ(questionPattern, answer, intent = 'general_faq') {
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
 * List all FAQ entries.
 */
export async function listFAQs({ page = 1, limit = 50 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await supabase
    .from('chatbot_qa')
    .select('*', { count: 'exact' })
    .order('usage_count', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], total: count, page, limit };
}

/**
 * Delete a FAQ entry.
 */
export async function deleteFAQ(id) {
  const { error } = await supabase.from('chatbot_qa').delete().eq('id', id);
  if (error) throw error;
}

// ─── Conversation Analytics ───────────────────────────────────────────────────

/**
 * Get chatbot analytics.
 * @param {{ start?: string, end?: string }} range
 */
export async function getChatbotAnalytics({ start, end } = {}) {
  let query = supabase
    .from('chatbot_messages')
    .select('role, intent, session_id, lang, created_at');

  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  const messages = data || [];
  const sessions = new Set(messages.map((m) => m.session_id));
  const botMessages = messages.filter((m) => m.role === 'bot');
  const escalations = botMessages.filter((m) => ['fallback', 'escalate'].includes(m.intent));

  const intentCounts = botMessages.reduce((acc, m) => {
    if (m.intent) acc[m.intent] = (acc[m.intent] || 0) + 1;
    return acc;
  }, {});

  const langCounts = messages.reduce((acc, m) => {
    if (m.lang) acc[m.lang] = (acc[m.lang] || 0) + 1;
    return acc;
  }, {});

  return {
    total_messages: messages.length,
    total_sessions: sessions.size,
    escalation_count: escalations.length,
    escalation_rate: sessions.size > 0 ? +((escalations.length / sessions.size) * 100).toFixed(1) : 0,
    avg_messages_per_session: sessions.size > 0 ? +(messages.length / sessions.size).toFixed(1) : 0,
    intent_breakdown: intentCounts,
    language_breakdown: langCounts,
  };
}

/**
 * Get chat history for a user.
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
 */
export async function clearChatHistory(userId) {
  const { error } = await supabase.from('chatbot_messages').delete().eq('user_id', userId);
  if (error) throw error;
}
