/**
 * Conversation service - saves ask/answer exchanges to MongoDB.
 */

import Conversation from '../models/Conversation.js';

/**
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.question
 * @param {string} [params.questionLanguage]
 * @param {string} params.answer
 * @param {string} [params.answerLanguage]
 * @param {string} [params.audioUrl]
 * @param {number} [params.executionTimeMs]
 */
export async function saveConversation(params) {
  const {
    userId,
    question,
    questionLanguage = 'unknown',
    answer,
    answerLanguage = 'en',
    audioUrl,
    executionTimeMs,
  } = params;

  const conversation = await Conversation.create({
    userId,
    question,
    questionLanguage,
    answer,
    answerLanguage,
    audioUrl: audioUrl || undefined,
    executionTimeMs: executionTimeMs || undefined,
  });

  return conversation;
}

/**
 * Get last N conversations for user (for conversational context).
 * @param {string} userId
 * @param {number} limit - Default 3
 * @returns {Promise<Array<{question: string, answer: string}>>}
 */
export async function getConversationHistory(userId, limit = 3) {
  const conversations = await Conversation.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('question answer')
    .lean();

  return conversations.reverse().map((c) => ({ question: c.question, answer: c.answer }));
}
