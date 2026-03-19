import {
  generateBotResponse,
  getChatHistory,
  clearChatHistory,
  getPopularQuestionsData,
  trainCustomResponse,
  getChatbotAnalyticsData,
} from '../services/chatbot.service.js';

export async function sendMessage(req, res, next) {
  try {
    const { message, session_id } = req.body;
    const data = await generateBotResponse(req.user.id, message, session_id || null);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getChatHistoryHandler(req, res, next) {
  try {
    const data = await getChatHistory(req.user.id, Number(req.query.limit) || 50);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function clearHistoryHandler(req, res, next) {
  try {
    await clearChatHistory(req.user.id);
    res.json({ success: true, message: 'Chat history cleared.' });
  } catch (err) { next(err); }
}

export async function getPopularQuestions(req, res, next) {
  try {
    const data = await getPopularQuestionsData();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function trainResponse(req, res, next) {
  try {
    const { question_pattern, answer, intent } = req.body;
    const data = await trainCustomResponse(question_pattern, answer, intent);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getChatbotAnalytics(req, res, next) {
  try {
    const { start, end } = req.query;
    const data = await getChatbotAnalyticsData({ start, end });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
