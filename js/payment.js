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
    },

    // ── Verify payment status ────────────────────────────────────────────────

    verifyPayment: async function (orderId) {
      var sb = _sb();
      var result = await sb.from('payments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (result.error) return { status: 'unknown', verified: false };
      var payment = result.data;
      return {
        verified: payment.status === 'paid' || payment.status === 'completed',
        status: payment.status,
        gateway: payment.gateway,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transaction_id,
        payment: payment
      };
    },

    // ── Show payment success UI ──────────────────────────────────────────────

    showPaymentSuccess: async function (orderId) {
      // Update order payment status in Supabase
      var sb = _sb();
      await sb.from('orders')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', orderId);

      // Update payment record
      await sb.from('payments')
        .update({ status: 'paid' })
        .eq('order_id', orderId)
        .eq('status', 'pending');

      // Render success message using DOM APIs to prevent XSS
      var container = document.getElementById('payment-result') ||
        document.getElementById('payment-status') ||
        document.querySelector('[data-payment-result]');
      if (container) {
        container.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'text-align:center;padding:40px 20px';

        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px';
        iconWrap.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

        var heading = document.createElement('h2');
        heading.style.cssText = 'color:#16a34a;font-size:1.5rem;font-weight:700;margin:0 0 8px';
        heading.textContent = 'Payment Successful!';

        var para = document.createElement('p');
        para.style.cssText = 'color:#475569;margin:0 0 16px';
        para.appendChild(document.createTextNode('Your order '));
        var strong = document.createElement('strong');
        strong.textContent = '#' + String(orderId).substring(0, 8);
        para.appendChild(strong);
        para.appendChild(document.createTextNode(' has been confirmed.'));

        var link = document.createElement('a');
        link.href = '/pages/order/details.html?id=' + encodeURIComponent(String(orderId));
        link.style.cssText = 'display:inline-block;padding:10px 24px;background:#0052CC;color:#fff;text-decoration:none;border-radius:8px;font-weight:600';
        link.textContent = 'View Order';

        wrapper.appendChild(iconWrap);
        wrapper.appendChild(heading);
        wrapper.appendChild(para);
        wrapper.appendChild(link);
        container.appendChild(wrapper);
      }

      if (global.GlobexUtils && global.GlobexUtils.showToast) {
        global.GlobexUtils.showToast('Payment successful! Order confirmed.', 'success');
      }
    },

    // ── Show payment error UI ────────────────────────────────────────────────

    showPaymentError: function (message) {
      var container = document.getElementById('payment-result') ||
        document.getElementById('payment-status') ||
        document.querySelector('[data-payment-result]');
      if (container) {
        container.innerHTML =
          '<div style="text-align:center;padding:40px 20px">' +
            '<div style="width:64px;height:64px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
              '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</div>' +
            '<h2 style="color:#dc2626;font-size:1.5rem;font-weight:700;margin:0 0 8px">Payment Failed</h2>' +
            '<p style="color:#475569;margin:0 0 16px" data-payment-error-message></p>' +
            '<button onclick="history.back()" ' +
              'style="display:inline-block;padding:10px 24px;background:#0052CC;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">' +
              'Try Again' +
            '</button>' +
          '</div>';
        var msgEl = container.querySelector('[data-payment-error-message]');
        if (msgEl) {
          msgEl.textContent = String(message || 'An error occurred while processing your payment. Please try again.');
        }
      }

      if (global.GlobexUtils && global.GlobexUtils.showToast) {
        global.GlobexUtils.showToast(message || 'Payment failed. Please try again.', 'error');
      }
    },

    // ── Render payment method cards ──────────────────────────────────────────

    renderPaymentMethods: async function (containerEl, amount, currency, orderId) {
      if (typeof containerEl === 'string') {
        containerEl = document.querySelector(containerEl);
      }
      if (!containerEl) return;

      var gateways = await this.getActiveGateways();
      if (!gateways || gateways.length === 0) {
        containerEl.innerHTML = '<p style="color:#94a3b8;text-align:center">No payment methods available.</p>';
        return;
      }

      var icons = {
        stripe:     '💳',
        bkash:      '📱',
        nagad:      '📱',
        sslcommerz: '🏦',
        alipay:     '🟦',
        wechat:     '🟢',
        crypto:     '₿',
        cod:        '🚚',
        bank:       '🏦'
      };

      var labels = {
        stripe:     'Credit / Debit Card',
        bkash:      'bKash',
        nagad:      'Nagad',
        sslcommerz: 'SSLCommerz',
        alipay:     'Alipay',
        wechat:     'WeChat Pay',
        crypto:     'Cryptocurrency',
        cod:        'Cash on Delivery',
        bank:       'Bank Transfer'
      };

      var self = this;
      var html = '<div style="display:grid;gap:12px">';
      gateways.forEach(function (gw) {
        var key = gw.gateway;
        html +=
          '<div class="payment-method-card" data-gateway="' + key + '" ' +
            'style="display:flex;align-items:center;gap:16px;padding:16px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;transition:border-color .2s"' +
            ' onmouseover="this.style.borderColor=\'#0052CC\'" onmouseout="this.style.borderColor=\'#e2e8f0\'">' +
            '<span style="font-size:1.5rem">' + (icons[key] || '💰') + '</span>' +
            '<div style="flex:1">' +
              '<div style="font-weight:600;color:#1e293b">' + (labels[key] || key) + '</div>' +
              '<div style="font-size:.8rem;color:#94a3b8">Pay securely</div>' +
            '</div>' +
            '<button data-pay-btn="' + key + '" ' +
              'style="padding:8px 16px;background:#0052CC;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.85rem">' +
              'Pay' +
            '</button>' +
          '</div>';
      });
      html += '</div>';
      containerEl.innerHTML = html;

      // Wire up pay buttons
      containerEl.querySelectorAll('[data-pay-btn]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var gateway = btn.getAttribute('data-pay-btn');
          btn.disabled = true;
          btn.textContent = 'Processing…';
          try {
            var result = await self.initPayment(gateway, amount, currency || 'USD', orderId, { amount: amount, currency: currency });
            if (result && result.redirect) {
              global.location.href = result.redirect;
            } else if (result && (result.status === 'paid' || result.status === 'completed')) {
              self.showPaymentSuccess(orderId);
            } else if (result && result.message) {
              // Instruction-only / pending flows (COD, bank transfer):
              // show instructions without marking order as paid.
              var instructionEl = containerEl.querySelector('.gp-payment-instructions');
              if (!instructionEl) {
                instructionEl = document.createElement('div');
                instructionEl.className = 'gp-payment-instructions';
                instructionEl.style.cssText = 'margin-top:12px;padding:12px;background:#f8fafc;border-radius:8px;color:#0f172a;font-size:.9rem';
                containerEl.appendChild(instructionEl);
              }
              instructionEl.textContent = result.message;
              btn.disabled = false;
              btn.textContent = 'Pay';
            } else {
              btn.disabled = false;
              btn.textContent = 'Pay';
            }
          } catch (err) {
            self.showPaymentError(err.message);
            btn.disabled = false;
            btn.textContent = 'Pay';
          }
        });
      });
    }
  };

  global.GlobexPayment = GlobexPayment;

}(typeof window !== 'undefined' ? window : this));
