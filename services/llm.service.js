/**
 * LLM service - completion only. No DB calls.
 * Primary: OpenAI GPT. Fallback: Groq.
 * Prompt: system (district collector AI) + user (context + question).
 */

import OpenAI from "openai";
import axios from "axios";
import logger from "../config/logger.js";
import { LLMCompletionError } from "../utils/EmbeddingError.js";
import { getOpenAIClient } from "../config/openai.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1024;

const RETRY_DELAYS_MS = [500, 1000, 2000];
const RETRY_STATUS_CODES = [429, 503];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @typedef {Object} LLMCompletionOptions
 * @property {string} systemPrompt
 * @property {string} userMessage - Contains context + question
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {Array<{question: string, answer: string}>} [conversationHistory]
 */

/**
 * @typedef {Object} LLMCompletionResult
 * @property {string} answer
 * @property {string} finishReason
 * @property {number} usage - Total tokens
 * @property {number} [responseTimeMs]
 */

/**
 * Call OpenAI chat completions.
 */
async function completeWithOpenAI(options) {
  const client = getOpenAIClient();
  if (!client) return null;

  const {
    systemPrompt,
    userMessage,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    conversationHistory = [],
  } = options;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.flatMap((h) => [
      { role: "user", content: h.question },
      { role: "assistant", content: h.answer },
    ]),
    { role: "user", content: userMessage },
  ];

  const start = performance.now();
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: Math.max(0, Math.min(1, temperature)),
    max_tokens: Math.max(1, Math.min(4096, maxTokens)),
  });
  const responseTimeMs = Math.round(performance.now() - start);

  const choice = response.choices?.[0];
  const content = choice?.message?.content ?? "";
  const finishReason = choice?.finish_reason ?? "stop";
  const usage = response.usage?.total_tokens ?? 0;

  logger.info("LLM completion (OpenAI)", {
    model: OPENAI_MODEL,
    tokens: usage,
    responseTimeMs,
  });

  return {
    answer: content.trim(),
    finishReason,
    usage,
    responseTimeMs,
  };
}

/**
 * Call Groq chat completions (primary for /ask or fallback after OpenAI).
 * @param {{ isAskPipelineGroq?: boolean }} [groqMeta]
 */
async function completeWithGroq(options, groqMeta = {}) {
  const { isAskPipelineGroq = false } = groqMeta;
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const {
    systemPrompt,
    userMessage,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    conversationHistory = [],
  } = options;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.flatMap((h) => [
      { role: "user", content: h.question },
      { role: "assistant", content: h.answer },
    ]),
    { role: "user", content: userMessage },
  ];

  const payload = {
    model: FALLBACK_MODEL,
    messages,
    temperature: Math.max(0, Math.min(1, temperature)),
    max_tokens: Math.max(1, Math.min(4096, maxTokens)),
  };

  const start = performance.now();
  const response = await axios.post(GROQ_API_URL, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
  });
  const responseTimeMs = Math.round(performance.now() - start);

  const data = response.data;
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? "";
  const finishReason = choice?.finish_reason ?? "unknown";
  const usage = data.usage?.total_tokens ?? 0;

  logger.info(
    isAskPipelineGroq ? "LLM completion (Groq)" : "LLM completion (Groq fallback)",
    {
      model: FALLBACK_MODEL,
      tokens: usage,
      responseTimeMs,
    },
  );

  return {
    answer: content.trim(),
    finishReason,
    usage,
    responseTimeMs,
  };
}

/**
 * Send messages to LLM and return structured response.
 * Uses OpenAI GPT when configured; falls back to Groq on failure or when OpenAI unavailable.
 * When meta.preferGroq is true (e.g. /ask pipeline), uses Groq only.
 *
 * @param {LLMCompletionOptions} options
 * @param {{ preferGroq?: boolean }} [meta]
 * @returns {Promise<LLMCompletionResult>}
 */
export async function complete(options, meta = {}) {
  const { preferGroq = false } = meta;
  const {
    systemPrompt,
    userMessage,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    conversationHistory = [],
  } = options;

  const start = performance.now();

  if (preferGroq) {
    logger.info("LLM routing: Groq only (ask pipeline)");
  }

  // Try OpenAI first (skip when /ask requests Groq-only)
  const client = !preferGroq ? getOpenAIClient() : null;
  if (client) {
    try {
      const result = await completeWithOpenAI({
        systemPrompt,
        userMessage,
        temperature,
        maxTokens,
        conversationHistory,
      });
      if (result) return result;
    } catch (err) {
      logger.warn("OpenAI LLM failed, trying Groq fallback", {
        error: err.message,
      });
    }
  }

  // Fallback to Groq
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) {
    throw new LLMCompletionError(
      preferGroq
        ? "GROQ_API_KEY is required for the ask pipeline."
        : "No LLM configured. Set OPENAI_API_KEY or GROQ_API_KEY.",
    );
  }

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await completeWithGroq(
        {
          systemPrompt,
          userMessage,
          temperature,
          maxTokens,
          conversationHistory,
        },
        { isAskPipelineGroq: preferGroq },
      );
      if (result) return result;
    } catch (err) {
      lastError = err;
      const status = err.response?.status ?? err.status ?? err.statusCode;
      const isRetryable = RETRY_STATUS_CODES.includes(status);

      if (isRetryable && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        logger.warn("Groq rate limited, retrying", { attempt: attempt + 1, delayMs: delay });
        await sleep(delay);
        continue;
      }

      const responseTimeMs = Math.round(performance.now() - start);
      logger.error("LLM completion failed", {
        tokens: 0,
        responseTimeMs,
        error: err.message,
      });

      if (status === 401) {
        throw new LLMCompletionError("Invalid Groq API key", err);
      }
      if (status === 429) {
        throw new LLMCompletionError("Groq rate limit exceeded", err);
      }
      if (status === 503) {
        throw new LLMCompletionError("Groq service unavailable", err);
      }
      throw new LLMCompletionError(
        err.response?.data?.error?.message || err.message || "LLM completion failed",
        err
      );
    }
  }

  const responseTimeMs = Math.round(performance.now() - start);
  logger.error("LLM completion failed after retries", {
    tokens: 0,
    responseTimeMs,
    error: lastError?.message,
  });

  throw new LLMCompletionError(
    lastError?.message || "LLM completion failed after retries",
    lastError
  );
}
