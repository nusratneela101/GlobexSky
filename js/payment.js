/**
 * js/payment.js — Multi-gateway payment system.
 *
 * Gateways: Stripe, bKash, Nagad, SSLCommerz, Alipay, WeChat Pay,
 *           Cryptocurrency, Bank Transfer, Cash on Delivery.
 *
 * Gateway config (publishable / public keys only) is loaded from
 * the payment_settings table in Supabase.
 * Secret keys MUST stay on a server — never in this file.
 *
 * Usage:
 *   GlobexPayment.getActiveGateways()
 *   GlobexPayment.initPayment(gateway, amount, currency, orderId, meta)
 *   GlobexPayment.recordPayment(orderId, gateway, amount, currency, txId, status)
 */
(function (global) {
  'use strict';

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var GlobexPayment = {

    // ── Load active gateways from Supabase ───────────────────────────────────

    getActiveGateways: async function () {
      var sb = _sb();
      var result = await sb.from('payment_settings')
        .select('*')
        .eq('is_active', true)
        .order('gateway');
      return result.data || [];
    },

    // ── Load all gateways (admin) ────────────────────────────────────────────

    getAllGateways: async function () {
      var sb = _sb();
      var result = await sb.from('payment_settings').select('*').order('gateway');
      return result.data || [];
    },

    // ── Toggle gateway on/off (admin) ────────────────────────────────────────

    toggleGateway: async function (gateway, isActive) {
      var sb = _sb();
      var result = await sb.from('payment_settings')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('gateway', gateway);
      if (result.error) throw result.error;
    },

    // ── Save gateway config (admin, publishable keys only) ───────────────────

    saveGatewayConfig: async function (gateway, config) {
      var sb = _sb();
      var result = await sb.from('payment_settings')
        .update({ config: config, updated_at: new Date().toISOString() })
        .eq('gateway', gateway);
      if (result.error) throw result.error;
    },

    // ── Record a payment in DB ───────────────────────────────────────────────

    recordPayment: async function (orderId, gateway, amount, currency, txId, status, gatewayResponse) {
      var sb = _sb();
      var user = await sb.auth.getUser();
      var result = await sb.from('payments').insert({
        order_id: orderId,
        user_id: user.data.user ? user.data.user.id : null,
        gateway: gateway,
        amount: amount,
        currency: currency || 'USD',
        status: status || 'pending',
        transaction_id: txId || null,
        gateway_response: gatewayResponse || null
      }).select().single();
      if (result.error) throw result.error;
      return result.data;
    },

    // ── Initiate payment ─────────────────────────────────────────────────────

    initPayment: async function (gateway, amount, currency, orderId, meta) {
      switch (gateway) {
        case 'stripe':     return await this._initStripe(amount, currency, orderId, meta);
        case 'bkash':      return await this._initBkash(amount, orderId);
        case 'nagad':      return await this._initNagad(amount, orderId);
        case 'sslcommerz': return await this._initSSLCommerz(amount, orderId, meta);
        case 'alipay':     return await this._initAlipay(amount, orderId);
        case 'wechat':     return await this._initWeChat(amount, orderId);
        case 'crypto':     return await this._initCrypto(amount, currency, orderId);
        case 'cod':        return await this._initManual('cod', orderId, meta);
        case 'bank':       return await this._initManual('bank', orderId, meta);
        default:           throw new Error('Unknown gateway: ' + gateway);
      }
    },

    // ── Stripe ───────────────────────────────────────────────────────────────

    _initStripe: async function (amount, currency, orderId, meta) {
      var sb = _sb();
      var settings = await sb.from('payment_settings').select('config').eq('gateway', 'stripe').single();
      var publishableKey = settings.data && settings.data.config && settings.data.config.publishable_key;
      if (!publishableKey) throw new Error('Stripe publishable key not configured');

      // Stripe.js must be loaded: <script src="https://js.stripe.com/v3/"></script>
      if (!global.Stripe) throw new Error('Stripe.js not loaded');
      var stripe = global.Stripe(publishableKey);

      // In real use, your server creates a PaymentIntent and returns client_secret.
      // Here we return the stripe object for the caller to create a Payment Element.
      return { stripe: stripe, amount: amount, currency: currency || 'usd' };
    },

    // ── bKash (redirect flow) ────────────────────────────────────────────────

    _initBkash: async function (amount, orderId) {
      // bKash requires a backend to generate payment URL.
      // Redirect to backend endpoint or show instructions.
      var url = '/api/payment/bkash/create?amount=' + amount + '&orderId=' + orderId;
      return { redirect: url, gateway: 'bkash', amount: amount };
    },

    // ── Nagad (redirect flow) ────────────────────────────────────────────────

    _initNagad: async function (amount, orderId) {
      var url = '/api/payment/nagad/create?amount=' + amount + '&orderId=' + orderId;
      return { redirect: url, gateway: 'nagad', amount: amount };
    },

    // ── SSLCommerz (redirect flow) ───────────────────────────────────────────

    _initSSLCommerz: async function (amount, orderId, meta) {
      var url = '/api/payment/sslcommerz/create?amount=' + amount + '&orderId=' + orderId;
      return { redirect: url, gateway: 'sslcommerz', amount: amount };
    },

    // ── Alipay ───────────────────────────────────────────────────────────────

    _initAlipay: async function (amount, orderId) {
      var url = '/api/payment/alipay/create?amount=' + amount + '&orderId=' + orderId;
      return { redirect: url, gateway: 'alipay', amount: amount };
    },

    // ── WeChat Pay ───────────────────────────────────────────────────────────

    _initWeChat: async function (amount, orderId) {
      var url = '/api/payment/wechat/create?amount=' + amount + '&orderId=' + orderId;
      return { redirect: url, gateway: 'wechat', amount: amount };
    },

    // ── Crypto (CoinGate/NOWPayments) ────────────────────────────────────────

    _initCrypto: async function (amount, currency, orderId) {
      var sb = _sb();
      var settings = await sb.from('payment_settings').select('config').eq('gateway', 'crypto').single();
      var apiKey = settings.data && settings.data.config && settings.data.config.api_key;

      // NOWPayments free tier
      if (apiKey) {
        return {
          gateway: 'crypto',
          message: 'Crypto payment via NOWPayments',
          amount: amount,
          currency: currency
        };
      }
      return { gateway: 'crypto', amount: amount, currency: currency };
    },

    // ── Manual (COD / Bank Transfer) ─────────────────────────────────────────

    _initManual: async function (method, orderId, meta) {
      var result = await this.recordPayment(orderId, method, (meta && meta.amount) || 0, (meta && meta.currency) || 'USD', null, 'pending');
      return {
        gateway: method,
        paymentId: result.id,
        message: method === 'cod'
          ? 'Pay on delivery. Your order is confirmed.'
          : 'Transfer the amount to our bank account. Your order will be processed after confirmation.'
      };
    }
  };

  global.GlobexPayment = GlobexPayment;

}(typeof window !== 'undefined' ? window : this));
