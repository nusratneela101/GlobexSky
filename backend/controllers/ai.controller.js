/**
 * Globex Sky — AI Controller
 * Handles all AI-powered feature endpoints:
 * recommendations, fraud detection, search, chatbot, price optimization, translation.
 */

import * as recommendationService from '../services/ai/recommendation.service.js';
import * as fraudService from '../services/ai/fraudDetection.service.js';
import * as aiSearchService from '../services/ai/search.service.js';
import * as chatbotService from '../services/ai/chatbot.service.js';
import * as priceService from '../services/ai/priceOptimization.service.js';
import * as translationService from '../services/ai/translation.service.js';

// ─── Recommendations ──────────────────────────────────────────────────────────

/** GET /api/v1/ai/recommendations/:userId */
export async function getRecommendations(req, res, next) {
  try {
    const { userId } = req.params;
    const { type = 'personalized', limit = 12 } = req.query;
    const parsedLimit = Math.min(Number(limit) || 12, 50);

    let data;
    switch (type) {
      case 'collaborative':
        data = await recommendationService.collaborativeRecommendations(userId, parsedLimit);
        break;
      case 'content':
        data = await recommendationService.contentBasedRecommendations(userId, parsedLimit);
        break;
      case 'hybrid':
        data = await recommendationService.hybridRecommendations(userId, parsedLimit);
        break;
      case 'trending':
        data = await recommendationService.getTrendingProducts(parsedLimit);
        break;
      default:
        data = await recommendationService.getPersonalizedRecommendations(userId, parsedLimit);
    }

    res.json({ success: true, data, type });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/recommendations/product/:productId/similar */
export async function getSimilarProducts(req, res, next) {
  try {
    const { productId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const data = await recommendationService.similarProducts(productId, limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/recommendations/product/:productId/frequently-bought-together */
export async function getFrequentlyBoughtTogether(req, res, next) {
  try {
    const { productId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 6, 20);
    const data = await recommendationService.frequentlyBoughtTogether(productId, limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/recommendations/trending */
export async function getTrending(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await recommendationService.getTrendingProducts(limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────

/** POST /api/v1/ai/fraud-check */
export async function fraudCheck(req, res, next) {
  try {
    const { user_id, order_id, amount, ip_address, billing_address, shipping_address, user_created_at } = req.body;
    const result = await fraudService.scoreTransaction({
      user_id,
      order_id,
      amount,
      ip_address,
      billing_address,
      shipping_address,
      user_created_at,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/fraud/flagged */
export async function getFlaggedTransactions(req, res, next) {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const data = await fraudService.getFlaggedTransactions({ status, page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/ai/fraud/flagged/:flagId */
export async function reviewFlag(req, res, next) {
  try {
    const { flagId } = req.params;
    const { status } = req.body;
    const data = await fraudService.reviewFlaggedTransaction(flagId, status, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/fraud/list */
export async function addToFraudList(req, res, next) {
  try {
    const data = await fraudService.addToList(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/fraud/list */
export async function getFraudList(req, res, next) {
  try {
    const { type } = req.query;
    const data = await fraudService.getFraudList(type || null);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/ai/fraud/list/:entryId */
export async function removeFromFraudList(req, res, next) {
  try {
    await fraudService.removeFromList(req.params.entryId);
    res.json({ success: true, message: 'Entry removed.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/fraud/audit */
export async function getFraudAudit(req, res, next) {
  try {
    const { user_id, order_id, page = 1, limit = 50 } = req.query;
    const data = await fraudService.getFraudAuditTrail({ user_id, order_id, page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

// ─── AI Search ────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/search */
export async function search(req, res, next) {
  try {
    const { query, page = 1, limit = 20, category_id, minPrice, maxPrice } = req.body;
    const userId = req.user?.id || null;
    const data = await aiSearchService.aiSearch(query, { page, limit, category_id, minPrice, maxPrice }, userId);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/search/suggestions */
export async function getSearchSuggestions(req, res, next) {
  try {
    const { q } = req.query;
    const data = await aiSearchService.getSearchSuggestions(q);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/search/image */
export async function imageSearch(req, res, next) {
  try {
    const { image } = req.body;
    const data = await aiSearchService.imageSearch(image);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/search/voice */
export async function voiceSearch(req, res, next) {
  try {
    const { transcription, ...filters } = req.body;
    const userId = req.user?.id || null;
    const data = await aiSearchService.voiceSearch(transcription, filters, userId);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/search/barcode/:value */
export async function barcodeSearch(req, res, next) {
  try {
    const data = await aiSearchService.barcodeLookup(req.params.value);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/search/synonyms */
export async function getSynonyms(req, res, next) {
  try {
    const data = await aiSearchService.getSynonymMappings();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/search/synonyms */
export async function upsertSynonym(req, res, next) {
  try {
    const { keyword, synonyms } = req.body;
    const data = await aiSearchService.upsertSynonymMapping(keyword, synonyms);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/chatbot */
export async function chatbotMessage(req, res, next) {
  try {
    const { message, session_id, lang } = req.body;
    const data = await chatbotService.generateEnhancedBotResponse(
      req.user.id, message, session_id || null, lang || 'en',
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/chatbot/history */
export async function getChatHistory(req, res, next) {
  try {
    const data = await chatbotService.getChatHistory(req.user.id, Number(req.query.limit) || 50);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/ai/chatbot/history */
export async function clearChatHistory(req, res, next) {
  try {
    await chatbotService.clearChatHistory(req.user.id);
    res.json({ success: true, message: 'Chat history cleared.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/chatbot/faqs */
export async function listFAQs(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const data = await chatbotService.listFAQs({ page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/chatbot/faqs */
export async function upsertFAQ(req, res, next) {
  try {
    const { question_pattern, answer, intent } = req.body;
    const data = await chatbotService.upsertFAQ(question_pattern, answer, intent);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/ai/chatbot/faqs/:id */
export async function deleteFAQ(req, res, next) {
  try {
    await chatbotService.deleteFAQ(req.params.id);
    res.json({ success: true, message: 'FAQ deleted.' });
  } catch (err) { next(err); }
}

// ─── Price Optimization ───────────────────────────────────────────────────────

/** POST /api/v1/ai/price-optimize */
export async function priceOptimize(req, res, next) {
  try {
    const { product_id, type = 'demand' } = req.body;

    let data;
    switch (type) {
      case 'competitive':
        data = await priceService.competitivePriceAnalysis(product_id);
        break;
      case 'rules':
        data = await priceService.applyDynamicPricingRules(product_id);
        break;
      case 'elasticity':
        data = await priceService.estimatePriceElasticity(product_id);
        break;
      case 'markup':
        data = await priceService.dropshippingMarkupRecommendation(req.body.category_id || null);
        break;
      default:
        data = await priceService.demandBasedPricing(product_id);
    }

    res.json({ success: true, data, type });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/price-optimize/bulk */
export async function bulkPriceOptimize(req, res, next) {
  try {
    const { product_ids } = req.body;
    const data = await priceService.bulkPricingOptimization(product_ids);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Translation ──────────────────────────────────────────────────────────────

/** POST /api/v1/ai/translate */
export async function translate(req, res, next) {
  try {
    const { text, target_lang, source_lang = 'auto' } = req.body;
    const data = await translationService.translateText(text, target_lang, source_lang);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/translate/batch */
export async function batchTranslate(req, res, next) {
  try {
    const { texts, target_lang, source_lang = 'auto' } = req.body;
    const data = await translationService.batchTranslate(texts, target_lang, source_lang);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/translate/product/:productId */
export async function translateProduct(req, res, next) {
  try {
    const { target_lang } = req.body;
    const data = await translationService.translateProduct(req.params.productId, target_lang);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/translate/review/:reviewId */
export async function translateReview(req, res, next) {
  try {
    const { target_lang } = req.body;
    const data = await translationService.translateReview(req.params.reviewId, target_lang);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/ai/translate/chat/:messageId */
export async function translateChatMessage(req, res, next) {
  try {
    const { target_lang } = req.body;
    const data = await translationService.translateChatMessage(req.params.messageId, target_lang);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/translate/detect */
export async function detectLanguage(req, res, next) {
  try {
    const { text } = req.query;
    const lang = translationService.detectLanguage(text || '');
    res.json({ success: true, data: { lang, text } });
  } catch (err) { next(err); }
}

/** GET /api/v1/ai/translate/languages */
export async function getSupportedLanguages(req, res, next) {
  try {
    const data = await translationService.getSupportedLanguages();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/** GET /api/v1/ai/analytics */
export async function getAiAnalytics(req, res, next) {
  try {
    const { start, end } = req.query;
    const [chatbot, search] = await Promise.all([
      chatbotService.getChatbotAnalytics({ start, end }),
      aiSearchService.getSearchAnalytics(),
    ]);
    res.json({ success: true, data: { chatbot, search } });
  } catch (err) { next(err); }
}
