/**
 * js/flash-sales.js — Flash Sales with real-time countdown.
 *
 * Usage:
 *   GlobexFlashSales.getActiveSales()
 *   GlobexFlashSales.getUpcomingSales()
 *   GlobexFlashSales.startCountdown(endTime, elementId)
 *   GlobexFlashSales.loadSaleProducts(productIds)
 *   GlobexFlashSales.addToCart(productId, salePrice)
 */
(function (global) {
  'use strict';

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var _intervals = {};

  var GlobexFlashSales = {

    // ── Active sales ─────────────────────────────────────────────────────────

    getActiveSales: async function () {
      var sb = _sb();
      var now = new Date().toISOString();
      var result = await sb
        .from('flash_sales')
        .select('*')
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true });
      if (result.error) throw result.error;
      return result.data || [];
    },

    // ── Upcoming sales ───────────────────────────────────────────────────────

    getUpcomingSales: async function () {
      var sb = _sb();
      var now = new Date().toISOString();
      var result = await sb
        .from('flash_sales')
        .select('*')
        .eq('is_active', true)
        .gt('start_time', now)
        .order('start_time', { ascending: true })
        .limit(6);
      if (result.error) throw result.error;
      return result.data || [];
    },

    // ── Load products for a sale ─────────────────────────────────────────────

    loadSaleProducts: async function (productIds, discountPercent) {
      if (!productIds || !productIds.length) return [];
      var sb = _sb();
      var result = await sb
        .from('products')
        .select('id,name,price,image_url,stock_quantity,category')
        .in('id', productIds);
      if (result.error) throw result.error;

      return (result.data || []).map(function (p) {
        var discount = discountPercent || 0;
        var salePrice = +(p.price * (1 - discount / 100)).toFixed(2);
        return Object.assign({}, p, { sale_price: salePrice, discount_percent: discount });
      });
    },

    // ── Real-time countdown ──────────────────────────────────────────────────

    startCountdown: function (endTime, elementId) {
      if (_intervals[elementId]) clearInterval(_intervals[elementId]);

      function update() {
        var remaining = new Date(endTime) - new Date();
        var el = document.getElementById(elementId);
        if (!el) { clearInterval(_intervals[elementId]); return; }

        if (remaining <= 0) {
          clearInterval(_intervals[elementId]);
          el.innerHTML = '<span style="color:#ef4444;font-weight:700">Sale Ended</span>';
          return;
        }

        var h = Math.floor(remaining / 3600000);
        var m = Math.floor((remaining % 3600000) / 60000);
        var s = Math.floor((remaining % 60000) / 1000);

        el.innerHTML =
          '<span class="countdown-unit"><span class="countdown-num">' + _pad(h) + '</span><span class="countdown-label">HRS</span></span>' +
          '<span class="countdown-sep">:</span>' +
          '<span class="countdown-unit"><span class="countdown-num">' + _pad(m) + '</span><span class="countdown-label">MIN</span></span>' +
          '<span class="countdown-sep">:</span>' +
          '<span class="countdown-unit"><span class="countdown-num">' + _pad(s) + '</span><span class="countdown-label">SEC</span></span>';
      }

      update();
      _intervals[elementId] = setInterval(update, 1000);
      return _intervals[elementId];
    },

    stopCountdown: function (elementId) {
      if (_intervals[elementId]) {
        clearInterval(_intervals[elementId]);
        delete _intervals[elementId];
      }
    },

    // ── Admin: create a flash sale ───────────────────────────────────────────

    createSale: async function (title, startTime, endTime, discountPercent, productIds) {
      var sb = _sb();
      var result = await sb.from('flash_sales').insert({
        title: title,
        start_time: startTime,
        end_time: endTime,
        discount_percent: discountPercent || 0,
        product_ids: productIds || [],
        is_active: true
      }).select().single();
      if (result.error) throw result.error;
      return result.data;
    },

    // ── Subscribe to new/updated sales ───────────────────────────────────────

    subscribeToSales: function (callback) {
      var sb = _sb();
      return sb.channel('flash-sales-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_sales' }, function (payload) {
          if (typeof callback === 'function') callback(payload);
        })
        .subscribe();
    }
  };

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }

  global.GlobexFlashSales = GlobexFlashSales;

}(typeof window !== 'undefined' ? window : this));
