/**
 * RAG service - Retrieval Augmented Generation.
 * Orchestrates: embed question → retrieve chunks → build context → LLM completion.
 * Handles retrieval; LLM handles completion only.
 */

import { generateEmbedding, searchSimilar } from './embeddingService.js';
import { getChunksByIds } from './embedding/chunkStore.js';
import { getConversationHistory } from './conversationService.js';
import { complete } from './llm.service.js';
import logger from '../config/logger.js';

const DEFAULT_SYSTEM_PROMPT =
  'You are a district collector AI avatar. Answer strictly from context.';

const DEFAULT_TOP_K = 5;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1024;
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_TOKENS = 6000;
const NO_CHUNKS_FALLBACK = "I don't have enough information.";

/**
 * Estimate token count from character length.
 */
function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within token limit.
 */
function truncateToTokenLimit(text, maxTokens) {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if ((text?.length ?? 0) <= maxChars) return text;
  return text.slice(0, maxChars).trim() + '\n\n[Context truncated...]';
}

/**
 * @typedef {Object} RAGOptions
 * @property {number} [topK] - Number of chunks to retrieve (default 5)
 * @property {number} [temperature] - LLM temperature 0-1 (default 0.3)
 * @property {number} [maxTokens] - Max tokens for LLM response (default 1024)
 * @property {string} [systemPrompt] - Override default system prompt
 * @property {string} [avatarId] - Namespace for vector search (isolates per avatar)
 * @property {string} [userId] - For conversation memory (last 3 interactions)
 */

/**
 * @typedef {Object} RAGResult
 * @property {string} answer
 * @property {string} finishReason
 * @property {number} usage
 * @property {number} chunksUsed
 * @property {number} [responseTimeMs]
 * @property {number} [totalTokens]
 */

/**
 * Run RAG pipeline: embed → retrieve → context → LLM.
 * @param {string} question - User question
 * @param {RAGOptions} [options]
 * @returns {Promise<RAGResult>}
 */
export async function ask(question, options = {}) {
  const start = performance.now();

  const {
    topK = DEFAULT_TOP_K,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    avatarId,
    userId,
  } = options;

  if (!question?.trim()) {
    throw new Error('Question is required');
  }

  const embedStart = performance.now();
  const queryVector = await generateEmbedding(question);

  const similar = await searchSimilar(queryVector, topK, {
    namespace: avatarId || 'default',
  });
  console.log('Retrieved chunks:', similar.length);

  let chunks = similar
    .map((s) => {
      const text = s.metadata?.text;
      return text ? { id: s.id, text, metadata: s.metadata } : null;
    })
    .filter(Boolean);

  if (chunks.length === 0) {
    chunks = getChunksByIds(similar.map((s) => s.id));
  }

  const retrievalTimeMs = Math.round(performance.now() - embedStart);

  if (chunks.length === 0) {
    const responseTimeMs = Math.round(performance.now() - start);
    logger.info('RAG completed (no chunks)', {
      chunksRetrieved: 0,
      totalTokens: 0,
      responseTimeMs,
    });
    return {
      answer: NO_CHUNKS_FALLBACK,
      finishReason: 'no_chunks',
      usage: 0,
      chunksUsed: 0,
      chunkCount: 0,
      responseTimeMs,
      retrievalTimeMs,
      llmTimeMs: 0,
      totalTokens: 0,
    };
  }

  let contextBlock = chunks.map((c) => c.text).join('\n\n---\n\n');
  const contextTokens = estimateTokens(contextBlock);

  if (contextTokens > MAX_CONTEXT_TOKENS) {
    contextBlock = truncateToTokenLimit(contextBlock, MAX_CONTEXT_TOKENS);
  }

  const userMessage = `Context:\n${contextBlock}\n\nQuestion: ${question.trim()}`;

  let conversationHistory = [];
  if (userId) {
    try {
      conversationHistory = await getConversationHistory(userId, 3);
    } catch (err) {
      logger.warn('Failed to load conversation history', { userId, error: err.message });
    }
  }

  const llmStart = performance.now();
  const result = await complete({
    systemPrompt,
    userMessage,
    temperature,
    maxTokens,
    conversationHistory,
  });
  const llmTimeMs = Math.round(performance.now() - llmStart);

  const responseTimeMs = Math.round(performance.now() - start);
  const totalTokens = result.usage;

  logger.info('RAG completed', {
    chunksRetrieved: chunks.length,
    totalTokens,
    responseTimeMs,
    retrievalTimeMs,
    llmTimeMs,
  });

  return {
    ...result,
    chunksUsed: chunks.length,
    chunkCount: chunks.length,
    responseTimeMs,
    retrievalTimeMs,
    llmTimeMs,
    totalTokens,
  };
}
