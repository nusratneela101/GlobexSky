/**
 * Saved Search Controller
 * Manage saved searches, search history, and trending searches.
 */

import SavedSearch from '../models/SavedSearch.js';
import SearchHistory from '../models/SearchHistory.js';

// ─── List saved searches ──────────────────────────────────────────────────────

/** GET /api/v1/searches/saved */
export async function listSavedSearches(req, res, next) {
  try {
    const data = await SavedSearch.findByUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Create saved search ─────────────────────────────────────────────────────

/** POST /api/v1/searches/saved */
export async function createSavedSearch(req, res, next) {
  try {
    const { query, filters, name, alertEnabled } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required.' });
    }

    const savedSearch = await SavedSearch.createForUser(req.user.id, {
      query,
      filters: filters || {},
      name: name || null,
      alertEnabled: alertEnabled || false,
    });

    res.status(201).json({ success: true, data: savedSearch });
  } catch (err) { next(err); }
}

// ─── Update saved search ─────────────────────────────────────────────────────

/** PUT /api/v1/searches/saved/:id */
export async function updateSavedSearch(req, res, next) {
  try {
    const { name } = req.body;

    const existing = await SavedSearch.findByIdAndUser(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found' });

    const savedSearch = await SavedSearch.updateName(req.params.id, name);
    res.json({ success: true, data: savedSearch });
  } catch (err) { next(err); }
}

// ─── Toggle alert ─────────────────────────────────────────────────────────────

/** PATCH /api/v1/searches/saved/:id/alert */
export async function toggleAlert(req, res, next) {
  try {
    const { enabled } = req.body;

    const existing = await SavedSearch.findByIdAndUser(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found' });

    const savedSearch = await SavedSearch.setAlert(req.params.id, enabled);
    res.json({ success: true, data: savedSearch });
  } catch (err) { next(err); }
}

// ─── Delete saved search ─────────────────────────────────────────────────────

/** DELETE /api/v1/searches/saved/:id */
export async function deleteSavedSearch(req, res, next) {
  try {
    const existing = await SavedSearch.findByIdAndUser(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found' });

    await SavedSearch.deleteByIdAndUser(req.params.id, req.user.id);
    res.json({ success: true, message: 'Saved search deleted.' });
  } catch (err) { next(err); }
}

// ─── Get search history ──────────────────────────────────────────────────────

/** GET /api/v1/searches/history */
export async function getSearchHistory(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await SearchHistory.findByUser(req.user.id, {
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Clear search history ────────────────────────────────────────────────────

/** DELETE /api/v1/searches/history */
export async function clearSearchHistory(req, res, next) {
  try {
    await SearchHistory.clearByUser(req.user.id);
    res.json({ success: true, message: 'Search history cleared.' });
  } catch (err) { next(err); }
}

// ─── Get trending searches ───────────────────────────────────────────────────

/** GET /api/v1/searches/trending */
export async function getTrendingSearches(req, res, next) {
  try {
    const data = await SearchHistory.getTrending();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
