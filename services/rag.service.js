/**
 * RAG service - Retrieval Augmented Generation.
 * Embed question → retrieve chunks (filter by avatarId) → build context → LLM completion.
 * Prompt: system ("You are a district collector AI...") + user (context + question).
 */

import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";
import { getConversationHistory } from "./conversationService.js";
import { generateEmbedding, searchSimilar } from "./embedding.service.js";
import { getChunksByIds } from "./embedding/chunkStore.js";
import { complete } from "./llm.service.js";

const DEFAULT_SYSTEM_PROMPT =
  "You are a district collector AI avatar. Answer strictly from context.";

const DEFAULT_TOP_K = 5;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1024;
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_TOKENS = 6000;
const NO_CHUNKS_ERROR =
  "No relevant context found for this avatar. Please upload documents or ensure avatarId is correct.";

function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / CHARS_PER_TOKEN);
}

function truncateToTokenLimit(text, maxTokens) {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if ((text?.length ?? 0) <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "\n\n[Context truncated...]";
}

/**
 * Run RAG pipeline: embed → retrieve (filter by avatarId) → context → LLM.
 * @param {string} question - User question
 * @param {Object} [options] - { topK=5, avatarId, userId, temperature, maxTokens, systemPrompt, preferGroq }
 * @returns {Promise<Object>} { answer, chunksUsed, chunkCount, totalTokens, responseTimeMs, ... }
 */
export async function ask(question, options = {}) {
  const start = performance.now();
  logger.info("RAG INPUT QUESTION", { question });
  const {
    topK = DEFAULT_TOP_K,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    avatarId,
    userId,
    preferGroq = false,
  } = options;

  if (!question?.trim()) {
    throw new Error("Question is required");
  }

  const namespace = avatarId || "default";

  const embedStart = performance.now();
  const queryVector = await generateEmbedding(question);

  const similar = await searchSimilar(queryVector, topK, {
    namespace,
  });

  logger.debug("RAG retrieved chunks", {
    chunkCount: similar.length,
    avatarId: namespace,
    retrievedChunks: similar.map((s) => ({
      id: s.id,
      score: s.score?.toFixed(4),
      hasText: Boolean(s.metadata?.text),
    })),
  });

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

  // No chunks → throw proper error instead of silent fallback
  if (chunks.length === 0) {
    logger.warn("RAG no chunks found", { avatarId: namespace });
    throw new AppError(NO_CHUNKS_ERROR, 404, "NO_CONTEXT_FOUND");
  }

  logger.debug("RAG chunk count", {
    chunkCount: chunks.length,
    avatarId: namespace,
  });

  let contextBlock = chunks.map((c) => c.text).join("\n\n---\n\n");
  const contextTokens = estimateTokens(contextBlock);

  if (contextTokens > MAX_CONTEXT_TOKENS) {
    contextBlock = truncateToTokenLimit(contextBlock, MAX_CONTEXT_TOKENS);
  }

  // Inject context and question into user message
  const userMessage = `Context:\n${contextBlock}\n\nQuestion: ${question.trim()}`;

  let conversationHistory = [];
  if (userId) {
    try {
      conversationHistory = await getConversationHistory(userId, 3);
    } catch (err) {
      logger.warn("Failed to load conversation history", {
        userId,
        error: err.message,
      });
    }
  }

  const llmStart = performance.now();
  const result = await complete(
    {
      systemPrompt,
      userMessage,
      temperature,
      maxTokens,
      conversationHistory,
    },
    { preferGroq },
  );
  const llmTimeMs = Math.round(performance.now() - llmStart);

  const responseTimeMs = Math.round(performance.now() - start);
  const totalTokens = result.usage ?? 0;

  logger.info("RAG completed", {
    chunksRetrieved: chunks.length,
    chunkCount: chunks.length,
    avatarId: namespace,
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
