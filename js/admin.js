/**
 * js/admin.js — Real Supabase admin module.
 *
 * Depends on:
 *   - Supabase CDN + js/supabase.js (window.supabaseClient)
 *   - js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexAdmin.requireAdmin()
 *   GlobexAdmin.getDashboardStats()
 *   GlobexAdmin.loadUsers(params?)
 *   GlobexAdmin.loadAllOrders(params?)
 *   GlobexAdmin.loadProducts(params?)
 *   GlobexAdmin.init()
 */

(function (global) {
  'use strict';

  function _client() { return global.supabaseClient || null; }

  // ─── ILIKE escape ─────────────────────────────────────────────────────────

  function _escapeLike(str) {
    return String(str || '').replace(/[%_\\]/g, function(c) { return '\\' + c; });
  }

  // ─── Auth guard ────────────────────────────────────────────────────────────

  /**
   * Check if current user is an admin. Redirects if not.
   * @returns {Promise<boolean>}
   */
  function requireAdmin() {
    var sb = _client();
    if (!sb) {
      global.location.href = '/pages/auth/login.html';
      return Promise.resolve(false);
    }
    return sb.auth.getUser().then(function (result) {
      var user = result.data && result.data.user;
      if (!user) {
        global.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(global.location.href);
        return false;
      }
      return sb.from('profiles').select('role').eq('id', user.id).single()
        .then(function (profileResult) {
          var role = profileResult.data && profileResult.data.role;
          if (role !== 'admin' && role !== 'super_admin') {
            global.location.href = '/index.html';
            return false;
          }
          return true;
        });
    }).catch(function () {
      global.location.href = '/pages/auth/login.html';
      return false;
    });
  }

  // ─── Dashboard stats ───────────────────────────────────────────────────────

  /**
   * Get real dashboard statistics from Supabase.
   * @returns {Promise<object>}
   */
  function getDashboardStats() {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));

    return Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('products').select('id', { count: 'exact', head: true }),
      sb.from('orders').select('id,total_amount'),
    ]).then(function (results) {
      var totalUsers    = results[0].count || 0;
      var totalProducts = results[1].count || 0;
      var orders        = results[2].data  || [];
      var totalOrders   = orders.length;
      var totalRevenue  = orders.reduce(function (acc, o) {
        return acc + (Number(o.total_amount) || 0);
      }, 0);

      return {
        totalUsers:    totalUsers,
        totalProducts: totalProducts,
        totalOrders:   totalOrders,
        totalRevenue:  totalRevenue,
      };
    });
  }

  // ─── Load users ────────────────────────────────────────────────────────────

  /**
   * Get all user profiles (admin only).
   * @param {object} [params]  { limit, page, search }
   * @returns {Promise<object[]>}
   */
  function loadUsers(params) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    params = params || {};
    var limit = params.limit || 50;
    var page  = params.page  || 1;
    var from  = (page - 1) * limit;

    var query = sb.from('profiles').select('*');
    if (params.search) {
      var safeSearch = _escapeLike(params.search);
      query = query.or('full_name.ilike.%' + safeSearch + '%,email.ilike.%' + safeSearch + '%');
    }
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    });
  }

  // ─── Load orders ───────────────────────────────────────────────────────────

  /**
   * Get all orders (admin only).
   * @param {object} [params]  { limit, page, status }
   * @returns {Promise<object[]>}
   */
  function loadAllOrders(params) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    params = params || {};
    var limit = params.limit || 50;
    var page  = params.page  || 1;
    var from  = (page - 1) * limit;

    var query = sb.from('orders').select('*');
    if (params.status) query = query.eq('status', params.status);
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    });
  }

  // ─── Load products ─────────────────────────────────────────────────────────

  /**
   * Get all products for admin panel.
   * @param {object} [params]  { limit, page, category }
   * @returns {Promise<object[]>}
   */
  function loadProducts(params) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    params = params || {};
    var limit = params.limit || 50;
    var page  = params.page  || 1;
    var from  = (page - 1) * limit;

    var query = sb.from('products').select('*');
    if (params.category) query = query.eq('category', params.category);
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    return requireAdmin();
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexAdmin = {
    requireAdmin:      requireAdmin,
    getDashboardStats: getDashboardStats,
    loadUsers:         loadUsers,
    loadAllOrders:     loadAllOrders,
    loadProducts:      loadProducts,
    init:              init,
  };

}(typeof window !== 'undefined' ? window : this));
