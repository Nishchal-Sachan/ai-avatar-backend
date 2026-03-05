/**
 * LLM service - completion only. No DB calls.
 * Uses Groq API for chat completions with configurable temperature.
 */

import axios from 'axios';
import { LLMCompletionError } from '../utils/EmbeddingError.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama3-8b-8192';
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
 * @property {string} userMessage
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {Array<{role: string, content: string}>} [conversationHistory] - Optional prior messages
 */

/**
 * @typedef {Object} LLMCompletionResult
 * @property {string} answer
 * @property {string} finishReason
 * @property {number} usage
 */

/**
 * Send messages to Groq LLM and return structured response.
 * @param {LLMCompletionOptions} options
 * @returns {Promise<LLMCompletionResult>}
 */
export async function complete({
  systemPrompt,
  userMessage,
  temperature = DEFAULT_TEMPERATURE,
  maxTokens = DEFAULT_MAX_TOKENS,
  conversationHistory = [],
}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMCompletionError('Groq is not configured. Set GROQ_API_KEY.');
  }

  if (!complete._logged) {
    console.log('Using Groq LLM');
    complete._logged = true;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.flatMap((h) => [
      { role: 'user', content: h.question },
      { role: 'assistant', content: h.answer },
    ]),
    { role: 'user', content: userMessage },
  ];

  const payload = {
    model: DEFAULT_MODEL,
    messages,
    temperature: Math.max(0, Math.min(1, temperature)),
    max_tokens: Math.max(1, Math.min(4096, maxTokens)),
  };

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await axios.post(GROQ_API_URL, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const data = response.data;
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const finishReason = choice?.finish_reason ?? 'unknown';
      const usage = data.usage?.total_tokens ?? 0;

      return {
        answer: content.trim(),
        finishReason,
        usage,
      };
    } catch (err) {
      lastError = err;
      const status = err.response?.status ?? err.status ?? err.statusCode;
      const isRetryable = RETRY_STATUS_CODES.includes(status);

      if (isRetryable && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        await sleep(delay);
        continue;
      }

      if (status === 401) {
        throw new LLMCompletionError('Invalid Groq API key', err);
      }
      if (status === 429) {
        throw new LLMCompletionError('Groq rate limit exceeded', err);
      }
      if (status === 503) {
        throw new LLMCompletionError('Groq service unavailable', err);
      }
      throw new LLMCompletionError(
        err.response?.data?.error?.message || err.message || 'LLM completion failed',
        err
      );
    }
  }

  throw new LLMCompletionError(
    lastError?.message || 'LLM completion failed after retries',
    lastError
  );
}
