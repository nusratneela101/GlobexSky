import * as service from '../services/advancedSearch.service.js';

/** GET /api/v1/search */
export async function textSearch(req, res, next) {
  try {
    const { q = '', page = 1, limit = 20, category_id, minPrice, maxPrice, minRating, supplierId } = req.query;
    const filters = { category_id, minPrice, maxPrice, minRating, supplierId };
    const result = await service.fullTextSearch(q, filters, +page, +limit);
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit }, suggestion: result.suggestion });
  } catch (err) { next(err); }
}

/** GET /api/v1/search/autocomplete */
export async function autocomplete(req, res, next) {
  try {
    const { q = '', limit = 10 } = req.query;
    const result = await service.getAutocompleteSuggestions(q, +limit);
    res.json({ success: true, suggestions: result.suggestions });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/voice */
export async function voiceSearch(req, res, next) {
  try {
    const { transcription, ...filters } = req.body;
    const result = await service.processVoiceSearch(transcription, req.user?.id, filters);
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/image */
export async function imageSearch(req, res, next) {
  try {
    const { imageBase64, imageUrl } = req.body;
    const result = await service.processImageSearch(imageBase64 || null, imageUrl || null);
    res.json({ success: true, data: result.data, note: result.note });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/barcode */
export async function barcodeSearch(req, res, next) {
  try {
    const { barcode } = req.body;
    const result = await service.processBarcodeSearch(barcode);
    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
}

/** GET /api/v1/search/barcode/:code */
export async function barcodeSearchByParam(req, res, next) {
  try {
    const { code } = req.params;
    const result = await service.processBarcodeSearch(code);
    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
}

/** GET /api/v1/search/suggestions */
export async function getSearchSuggestions(req, res, next) {
  try {
    const { q = '' } = req.query;
    const result = await service.getAutocompleteSuggestions(q);
    res.json({ success: true, suggestions: result.suggestions });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/advanced */
export async function advancedSearch(req, res, next) {
  try {
    const { page = 1, limit = 20, ...filters } = req.body;
    const result = await service.advancedFilterSearch(filters, +page, +limit);
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/search/recommendations */
export async function getRecommendations(req, res, next) {
  try {
    const { context = '', limit = 12 } = req.query;
    const userId = req.user?.id || null;
    const result = await service.getRecommendations(context, userId, +limit);
    res.json({ success: true, data: result.data, context: result.context });
  } catch (err) { next(err); }
}

/** POST /api/v1/search/ai-chat */
export async function aiChat(req, res, next) {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user?.id || null;
    const result = await service.processAiChat(message, history, userId);
    res.json({ success: true, reply: result.reply, products: result.products, actions: result.actions });
  } catch (err) { next(err); }
}

/** GET /api/v1/search/analytics  (admin) */
export async function getSearchAnalytics(req, res, next) {
  try {
    const result = await service.getSearchAnalytics();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
