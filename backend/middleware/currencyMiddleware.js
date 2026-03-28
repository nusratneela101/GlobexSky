/**
 * currencyMiddleware.js
 *
 * Auto-attaches currency information to every request:
 *   req.currency.code      — the resolved currency code (e.g. 'USD')
 *   req.currency.info      — full currency descriptor from SUPPORTED_CURRENCIES
 *   req.currency.source    — 'preference' | 'query' | 'header' | 'auto-detect'
 *
 * Priority (highest → lowest):
 *   1. Authenticated user's saved preference (BuyerCurrencyPreference)
 *   2. ?currency=XXX query parameter
 *   3. X-Currency-Code request header
 *   4. Auto-detection via Accept-Language
 */

import BuyerCurrencyPreference from '../models/BuyerCurrencyPreference.js';
import {
  SUPPORTED_CURRENCIES,
  detectCurrencyFromRequest,
} from '../services/currencyConversion.service.js';

const SUPPORTED_SET = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

function resolveInfo(code) {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) ?? null;
}

export async function currencyMiddleware(req, _res, next) {
  try {
    // 1. Authenticated user's saved preference
    if (req.user?.id) {
      const pref = await BuyerCurrencyPreference.findByUser(req.user.id);
      if (pref?.preferred_currency && SUPPORTED_SET.has(pref.preferred_currency)) {
        req.currency = {
          code: pref.preferred_currency,
          info: resolveInfo(pref.preferred_currency),
          source: 'preference',
        };
        return next();
      }
    }

    // 2. Query parameter: ?currency=EUR
    const qParam = req.query?.currency?.toUpperCase();
    if (qParam && SUPPORTED_SET.has(qParam)) {
      req.currency = { code: qParam, info: resolveInfo(qParam), source: 'query' };
      return next();
    }

    // 3. Request header: X-Currency-Code: GBP
    const headerCode = req.headers['x-currency-code']?.toUpperCase();
    if (headerCode && SUPPORTED_SET.has(headerCode)) {
      req.currency = { code: headerCode, info: resolveInfo(headerCode), source: 'header' };
      return next();
    }

    // 4. Auto-detect via Accept-Language
    const detected = detectCurrencyFromRequest(req);
    req.currency = { code: detected, info: resolveInfo(detected), source: 'auto-detect' };
    return next();
  } catch (_err) {
    // Non-critical middleware — never block the request
    req.currency = { code: 'USD', info: resolveInfo('USD'), source: 'fallback' };
    return next();
  }
}
