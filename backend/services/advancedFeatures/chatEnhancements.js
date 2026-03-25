/**
 * Globex Sky — Chat Enhancements Service
 * Auto-translation, voice messages, read receipts, smart replies, and chat search.
 */

import supabase from '../../config/supabase.js';
import openaiClient from '../../config/openai.js';
import translationService from '../translation/translationService.js';

/**
 * Auto-translate a chat message from the sender's language to the recipient's language.
 * @param {string} messageId
 * @param {string} senderLang - ISO 639-1 sender language code
 * @param {string} recipientLang - ISO 639-1 recipient language code
 * @returns {Promise<object>}
 */
export async function autoTranslateMessage(messageId, senderLang, recipientLang) {
  if (senderLang === recipientLang) {
    return { messageId, translated: false, reason: 'same_language' };
  }

  const { data: msg, error } = await supabase
    .from('chat_messages')
    .select('id, content')
    .eq('id', messageId)
    .single();

  if (error) throw error;

  const result = await translationService.translateText(msg.content, senderLang, recipientLang);

  if (result.success) {
    await supabase.from('chat_message_translations').upsert([{
      message_id: messageId,
      target_lang: recipientLang,
      translated_content: result.translation,
    }], { onConflict: 'message_id,target_lang' });
  }

  return { messageId, ...result };
}

/**
 * Convert a voice message audio buffer to text using OpenAI Whisper.
 * @param {Buffer} audioBuffer - Raw audio data
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function processVoiceMessage(audioBuffer) {
  if (!openaiClient) {
    return { success: false, error: 'OpenAI client is not configured. Set OPENAI_API_KEY to enable voice processing.' };
  }

  try {
    const transcription = await openaiClient.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1',
    });
    return { success: true, text: transcription.text };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark a message as read by a user.
 * @param {string} messageId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function addReadReceipts(messageId, userId) {
  const { data, error } = await supabase
    .from('message_read_receipts')
    .upsert([{
      message_id: messageId,
      user_id: userId,
      read_at: new Date().toISOString(),
    }], { onConflict: 'message_id,user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all read receipts for a message.
 * @param {string} messageId
 * @returns {Promise<object[]>}
 */
export async function getReadReceipts(messageId) {
  const { data, error } = await supabase
    .from('message_read_receipts')
    .select('user_id, read_at')
    .eq('message_id', messageId)
    .order('read_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Generate AI-powered smart reply suggestions for a conversation.
 * @param {string} conversationId
 * @returns {Promise<{ success: boolean, suggestions?: string[], error?: string }>}
 */
export async function generateSmartReply(conversationId) {
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('content, sender_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  if (!openaiClient) {
    return { success: false, error: 'OpenAI client is not configured. Set OPENAI_API_KEY to enable smart replies.' };
  }

  try {
    const history = (messages ?? [])
      .reverse()
      .map((m) => `[${m.sender_id}]: ${m.content}`)
      .join('\n');

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for a B2B trade platform. Generate 3 concise, professional quick-reply suggestions (one sentence each) for the last message in this conversation. Return them as a JSON array of strings.',
        },
        { role: 'user', content: history },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{"suggestions":[]}');
    return { success: true, suggestions: parsed.suggestions ?? [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/** UUID v4 pattern used to validate IDs before use in filter strings */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Search through a user's chat history for messages matching a query.
 * @param {string} userId
 * @param {string} query
 * @returns {Promise<object[]>}
 */
export async function searchChatHistory(userId, query) {
  if (!UUID_RE.test(userId)) {
    throw new Error('Invalid userId format.');
  }

  // Escape ILIKE wildcards to prevent unintended pattern matching
  const safeQuery = query.replace(/[%_\\]/g, '\\$&');

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, content, sender_id, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .ilike('content', `%${safeQuery}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}
