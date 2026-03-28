/**
 * currencyDisplay.controller.js
 *
 * Endpoints for the multi-currency pricing display feature:
 *   GET  /supported          — list all supported currencies
 *   GET  /rates              — get current exchange rates
 *   GET  /preference         — get the authenticated user's preferred currency
 *   PUT  /preference         — set the authenticated user's preferred currency
 *   POST /convert            — convert a price (or array of prices)
 *   GET  /auto-detect        — detect currency from request headers
 */

import BuyerCurrencyPreference from '../models/BuyerCurrencyPreference.js';
import {
  SUPPORTED_CURRENCIES,
  getAllRates,
  convertPrice,
  bulkConvertPrices,
  detectCurrencyFromRequest,
  formatPrice,
} from '../services/currencyConversion.service.js';

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

// ─── GET /supported ──────────────────────────────────────────────────────────
export async function getSupportedCurrencies(req, res, next) {
  try {
    return res.json({ success: true, data: SUPPORTED_CURRENCIES });
  } catch (err) {
    next(err);
  }
}

// ─── GET /rates ───────────────────────────────────────────────────────────────
export async function getRates(req, res, next) {
  try {
    const base = (req.query.base || 'USD').toUpperCase();
    const rates = await getAllRates(base);
    return res.json({ success: true, data: { base, rates } });
  } catch (err) {
    next(err);
  }
}

// ─── GET /preference ──────────────────────────────────────────────────────────
export async function getPreference(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');

    const pref = await BuyerCurrencyPreference.findByUser(userId);
    if (!pref) {
      // Return a sensible default (auto-detect)
      const detected = detectCurrencyFromRequest(req);
      return res.json({
        success: true,
        data: { preferred_currency: detected, auto_detect: true },
      });
    }
    return res.json({ success: true, data: pref });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /preference ──────────────────────────────────────────────────────────
export async function setPreference(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');

    const { preferred_currency, auto_detect } = req.body;
    if (!preferred_currency) return sendError(res, 400, 'preferred_currency is required');

    const code = preferred_currency.toUpperCase();
    const supported = SUPPORTED_CURRENCIES.some(c => c.code === code);
    if (!supported) return sendError(res, 400, `Unsupported currency: ${code}`);

    const pref = await BuyerCurrencyPreference.setPreference(
      userId,
      code,
      !!auto_detect
    );
    return res.json({ success: true, data: pref });
  } catch (err) {
    next(err);
  }
}

// ─── POST /convert ─────────────────────────────────────────────────────────────
export async function convertPrices(req, res, next) {
  try {
    const { from, to, amount, amounts } = req.body;

    if (!from || !to) return sendError(res, 400, '"from" and "to" currency codes are required');

    // Bulk conversion
    if (Array.isArray(amounts)) {
      if (amounts.some(a => typeof a !== 'number' || isNaN(a))) {
        return sendError(res, 400, 'All values in "amounts" must be numbers');
      }
      const result = await bulkConvertPrices(amounts, from, to);
      const formatted = result.amounts.map(a => formatPrice(a, result.to));
      return res.json({ success: true, data: { ...result, formatted } });
    }

    // Single conversion
    if (amount === undefined || amount === null) {
      return sendError(res, 400, '"amount" or "amounts" is required');
    }
    if (typeof amount !== 'number' || isNaN(amount)) {
      return sendError(res, 400, '"amount" must be a number');
    }
    const result = await convertPrice(amount, from, to);
    return res.json({
      success: true,
      data: { ...result, formatted: formatPrice(result.amount, result.to) },
    });
  } catch (err) {
    if (err.message?.startsWith('Unsupported currency')) {
      return sendError(res, 400, err.message);
    }
    next(err);
  }
}

// ─── GET /auto-detect ─────────────────────────────────────────────────────────
export async function autoDetectCurrency(req, res, next) {
  try {
    const detected = detectCurrencyFromRequest(req);
    const info = SUPPORTED_CURRENCIES.find(c => c.code === detected);
    return res.json({ success: true, data: { currency: detected, info: info ?? null } });
  } catch (err) {
    next(err);
  }
}
