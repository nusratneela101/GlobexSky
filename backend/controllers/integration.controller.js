/**
 * Globex Sky — integration.controller.js
 * Admin endpoints for managing external product sync operations.
 */

import * as alibabaService from '../services/integrations/alibaba.service.js';
import * as china1688Service from '../services/integrations/1688.service.js';
import * as aliexpressService from '../services/integrations/aliexpress.service.js';
import supabase from '../config/supabase.js';

// ─── Alibaba ──────────────────────────────────────────────────────────────────

export async function syncAlibaba(req, res, next) {
  try {
    const result = await alibabaService.syncProducts();
    await _logSyncEvent('alibaba', result);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function searchAlibabaProducts(req, res, next) {
  try {
    const { keyword, page, pageSize, categoryId, minPrice, maxPrice } = req.query;
    const data = await alibabaService.searchProducts({ keyword, page: +page || 1, pageSize: +pageSize || 20, categoryId, minPrice: minPrice ? +minPrice : undefined, maxPrice: maxPrice ? +maxPrice : undefined });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function importAlibabaProduct(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'productId is required.' });
    const product = await alibabaService.importProduct(productId, req.user.id);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function getAlibabaSupplier(req, res, next) {
  try {
    const data = await alibabaService.getSupplierInfo(req.params.companyId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function compareAlibabaPrices(req, res, next) {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required.' });
    const data = await alibabaService.comparePrices(keyword);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── 1688 ─────────────────────────────────────────────────────────────────────

export async function sync1688(req, res, next) {
  try {
    const result = await china1688Service.syncProducts();
    await _logSyncEvent('1688', result);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function search1688Products(req, res, next) {
  try {
    const { keyword, page, pageSize, categoryId, minPrice, maxPrice } = req.query;
    const data = await china1688Service.searchProducts({ keyword, page: +page || 1, pageSize: +pageSize || 20, categoryId, minPrice: minPrice ? +minPrice : undefined, maxPrice: maxPrice ? +maxPrice : undefined });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function import1688Product(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'productId is required.' });
    const product = await china1688Service.importProduct(productId, req.user.id);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
}

// ─── AliExpress ───────────────────────────────────────────────────────────────

export async function syncAliexpress(req, res, next) {
  try {
    const result = await aliexpressService.monitorPrices();
    await _logSyncEvent('aliexpress', result);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function searchAliexpressProducts(req, res, next) {
  try {
    const { keyword, page, pageSize, categoryId, minPrice, maxPrice, shipToCountry } = req.query;
    const data = await aliexpressService.searchProducts({ keyword, page: +page || 1, pageSize: +pageSize || 20, categoryId, minPrice: minPrice ? +minPrice : undefined, maxPrice: maxPrice ? +maxPrice : undefined, shipToCountry });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function importAliexpressProduct(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'productId is required.' });
    const product = await aliexpressService.importProduct(productId, req.user.id);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function placeAliexpressOrder(req, res, next) {
  try {
    const result = await aliexpressService.placeOrder(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function trackAliexpressOrder(req, res, next) {
  try {
    const data = await aliexpressService.syncOrderTracking(req.params.orderId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Sync Status & Settings ───────────────────────────────────────────────────

export async function getSyncStatus(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateSyncSettings(req, res, next) {
  try {
    const { source, enabled, intervalMinutes } = req.body;
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({ source, enabled, interval_minutes: intervalMinutes, updated_by: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'source' })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _logSyncEvent(source, result) {
  await supabase.from('integration_sync_logs').insert({
    source,
    updated: result.updated || 0,
    errors: result.errors || 0,
    total: result.total || result.checked || 0,
    created_at: new Date().toISOString(),
  });
}
