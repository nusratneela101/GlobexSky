/**
 * js/ai.js — DeepSeek AI integration for GlobexSky.
 *
 * API: https://api.deepseek.com/v1/chat/completions
 * Model: deepseek-chat (free tier available)
 *
 * API key is stored in Supabase app_settings table (key = 'deepseek_api_key').
 * It is loaded once and cached for the page session.
 *
 * Usage:
 *   GlobexAI.chat('What products do you have?')
 *   GlobexAI.searchProducts('wireless headphones under $50')
 *   GlobexAI.negotiatePrice('Headphones', 100, 75)
 *   GlobexAI.recommendSuppliers('electronics', 'fast shipping, MOQ < 100')
 *   GlobexAI.trackOrder(orderId)
 */
(function (global) {
  'use strict';

  var _apiKey = null;
  var _history = [];

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  async function _loadKey() {
    if (_apiKey) return _apiKey;
    var sb = _sb();
    if (!sb) return null;
    try {
      var result = await sb.from('app_settings')
        .select('value')
        .eq('key', 'deepseek_api_key')
        .single();
      _apiKey = (result.data && result.data.value) || null;
    } catch (e) {
      _apiKey = null;
    }
    return _apiKey;
  }

  var GlobexAI = {
    _SYSTEM: 'You are GlobexSky AI assistant, helping buyers and suppliers on a B2B/B2C global marketplace. Be concise, helpful, and professional.',

    // ── Core chat ────────────────────────────────────────────────────────────

    chat: async function (userMessage, context) {
      var key = await _loadKey();
      if (!key) {
        return '⚠️ AI is not configured. Please add a DeepSeek API key in the admin panel under Settings → AI.';
      }

      _history.push({ role: 'user', content: userMessage });

      var sysContent = this._SYSTEM + (context ? ' ' + context : '');
      var messages = [{ role: 'system', content: sysContent }].concat(_history.slice(-20));

      try {
        var resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        if (!resp.ok) {
          var err = await resp.json();
          throw new Error(err.error && err.error.message || 'API error ' + resp.status);
        }

        var data = await resp.json();
        var reply = data.choices[0].message.content;
        _history.push({ role: 'assistant', content: reply });
        return reply;

      } catch (e) {
        return '❌ AI error: ' + e.message;
      }
    },

    // ── Smart product search ─────────────────────────────────────────────────

    searchProducts: async function (query) {
      var keywords = await this.chat(
        'Convert this search query to SQL-friendly keywords for a product database search: "' + query + '". Return only keywords separated by spaces, no explanation.',
        'You are a search query optimizer.'
      );
      return keywords.trim();
    },

    // ── Price negotiation ────────────────────────────────────────────────────

    negotiatePrice: async function (productName, currentPrice, userOffer) {
      return await this.chat(
        'Product: ' + productName + ', Listed price: $' + currentPrice + ', Buyer offers: $' + userOffer + '. Suggest a fair counter-offer and write a professional negotiation message (2-3 sentences).',
        'You are a skilled B2B trade negotiator.'
      );
    },

    // ── Supplier recommendation ───────────────────────────────────────────────

    recommendSuppliers: async function (category, requirements) {
      return await this.chat(
        'What should I look for when choosing a supplier for "' + category + '"? Requirements: ' + requirements + '. Provide 5 specific evaluation criteria.',
        'You are a sourcing expert.'
      );
    },

    // ── Order tracking assistant ─────────────────────────────────────────────

    trackOrder: async function (orderId) {
      var sb = _sb();
      var orderInfo = '';
      if (sb) {
        try {
          var result = await sb.from('orders').select('*').eq('id', orderId).single();
          if (result.data) {
            orderInfo = 'Order ID: ' + orderId + ', Status: ' + result.data.status + ', Created: ' + result.data.created_at;
          }
        } catch (e) {}
      }
      return await this.chat(
        orderInfo
          ? 'Help the customer understand the status of their order: ' + orderInfo
          : 'The customer asked about order ID: ' + orderId + '. No order found. Advise them to contact support.',
        ''
      );
    },

    // ── Clear conversation history ───────────────────────────────────────────

    clearHistory: function () {
      _history = [];
    },

    // ── Check if AI is configured ────────────────────────────────────────────

    isConfigured: async function () {
      var key = await _loadKey();
      return !!key;
    },

    // ── Save API key (admin) ─────────────────────────────────────────────────

    saveApiKey: async function (apiKey) {
      var sb = _sb();
      var result = await sb.from('app_settings')
        .upsert({ key: 'deepseek_api_key', value: apiKey, updated_at: new Date().toISOString() });
      if (result.error) throw result.error;
      _apiKey = apiKey;
    },

    // ── Init: preload config ─────────────────────────────────────────────────

    init: async function () {
      await _loadKey();
      return this.isConfigured();
    },

    // ── sendMessage alias for chat() ─────────────────────────────────────────

    sendMessage: async function (message, context) {
      return this.chat(message, context);
    }
  };

  global.GlobexAI = GlobexAI;

}(typeof window !== 'undefined' ? window : this));
