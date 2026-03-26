import SearchHistory from '../models/SearchHistory.js';
import SavedSearch   from '../models/SavedSearch.js';

const MAX_SAVED = 20;

/* ═══════════════════════════════════════════════════════
   SEARCH HISTORY
═══════════════════════════════════════════════════════ */

/** GET /api/v1/search/history */
export async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const result = await SearchHistory.findByUser(userId, { page: +page, limit: Math.min(+limit, 50) });
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/history */
export async function addToHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const { query, resultsCount } = req.body;
    const item = await SearchHistory.record(userId, query, resultsCount ?? null);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/search/history */
export async function clearHistory(req, res, next) {
  try {
    const userId = req.user.id;
    await SearchHistory.clearByUser(userId);
    res.json({ success: true, message: 'Search history cleared.' });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════
   SAVED SEARCHES
═══════════════════════════════════════════════════════ */

/** GET /api/v1/search/saved */
export async function getSaved(req, res, next) {
  try {
    const userId = req.user.id;
    const saved = await SavedSearch.findByUser(userId);
    res.json({ success: true, data: saved });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/saved */
export async function createSaved(req, res, next) {
  try {
    const userId = req.user.id;
    const { query, filters, name, alertEnabled } = req.body;

    const count = await SavedSearch.countByUser(userId);
    if (count >= MAX_SAVED) {
      return res.status(422).json({
        success: false,
        error: `Maximum of ${MAX_SAVED} saved searches reached.`,
      });
    }

    const item = await SavedSearch.createForUser(userId, { query, filters, name, alertEnabled });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

/** PUT /api/v1/search/saved/:id */
export async function updateSaved(req, res, next) {
  try {
    const userId = req.user.id;
    const { id }   = req.params;
    const { name } = req.body;

    const existing = await SavedSearch.findByIdAndUser(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found.' });

    const updated = await SavedSearch.updateName(id, userId, name);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/search/saved/:id */
export async function deleteSaved(req, res, next) {
  try {
    const userId = req.user.id;
    const { id }  = req.params;

    const existing = await SavedSearch.findByIdAndUser(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found.' });

    await SavedSearch.deleteByIdAndUser(id, userId);
    res.json({ success: true, message: 'Saved search deleted.' });
  } catch (err) { next(err); }
}

/** PUT /api/v1/search/saved/:id/alert */
export async function toggleAlert(req, res, next) {
  try {
    const userId = req.user.id;
    const { id }  = req.params;
    const { alertEnabled } = req.body;

    const existing = await SavedSearch.findByIdAndUser(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: 'Saved search not found.' });

    const updated = await SavedSearch.setAlert(id, userId, !!alertEnabled);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════
   TRENDING
═══════════════════════════════════════════════════════ */

/** GET /api/v1/search/trending */
export async function getTrending(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const trending = await SearchHistory.getTrending(Math.min(+limit, 20));
    res.json({ success: true, data: trending });
  } catch (err) { next(err); }
}
