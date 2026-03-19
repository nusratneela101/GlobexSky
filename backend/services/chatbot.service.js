import supabase from '../config/supabase.js';

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
 * Generate a response for a given message, checking custom Q&A pairs first.
 * @param {string} userId
 * @param {string} message
 * @param {string|null} sessionId
 */
export async function generateBotResponse(userId, message, sessionId = null) {
  const intent = classifyIntent(message);

  // Check custom Q&A pairs for a match
  const { data: customQA } = await supabase
    .from('chatbot_qa')
    .select('*')
    .ilike('question_pattern', `%${message.substring(0, 50)}%`)
    .limit(1)
    .single();

  const responseText = customQA?.answer || DEFAULT_RESPONSES[intent] || DEFAULT_RESPONSES.fallback;
  const shouldEscalate = intent === 'fallback' && !customQA;

  // Store message and response in history
  const sid = sessionId || `${userId}-${Date.now()}`;
  await supabase.from('chatbot_messages').insert([
    { session_id: sid, user_id: userId, role: 'user', content: message },
    { session_id: sid, user_id: userId, role: 'bot', content: responseText, intent },
  ]);

  return {
    session_id: sid,
    intent,
    response: responseText,
    should_escalate: shouldEscalate,
  };
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
