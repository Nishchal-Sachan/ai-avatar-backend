/**
 * Translation layer - OpenAI-powered.
 * Modular design with safe fallbacks. Uses fast model for minimal latency.
 * Features: skip-English, confidence threshold, in-memory cache, graceful fallback, logging.
 */

import crypto from 'crypto';
import { getOpenAIClient } from '../config/openai.js';
import logger from '../config/logger.js';

const TRANSLATION_MODEL = 'gpt-4o-mini';
const MAX_INPUT_LENGTH = 50000;
const CONFIDENCE_THRESHOLD = Number(process.env.TRANSLATION_CONFIDENCE_THRESHOLD) || 0.7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;

const ENGLISH_CODES = new Set(['en', 'english']);

/** @type {Map<string, { result: string; expiresAt: number }>} */
const translationCache = new Map();

function cacheKey(prefix, text) {
  const hash = crypto.createHash('md5').update(text).digest('hex');
  return `${prefix}:${hash}`;
}

function getCached(key) {
  const entry = translationCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) translationCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key, result) {
  if (translationCache.size >= CACHE_MAX_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Detect language of text. Returns ISO 639-1 code (e.g. 'en', 'hi').
 * Uses confidence threshold: if confidence < threshold, returns 'unknown'.
 * Safe fallback: empty input → 'unknown', API failure → 'unknown'.
 * @param {string} text
 * @returns {Promise<string>} Language code or 'unknown'
 */
export async function detectLanguage(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 'unknown';

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return 'unknown';
  }

  const client = getOpenAIClient();
  if (!client) return 'unknown';

  try {
    const response = await client.chat.completions.create({
      model: TRANSLATION_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Reply with only: ISO 639-1 language code,confidence. Example: en,0.95 or hi,0.88. No other text. Confidence is 0-1.',
        },
        { role: 'user', content: trimmed.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 15,
    });

    const raw = response.choices?.[0]?.message?.content?.trim()?.toLowerCase();
    if (!raw) return 'unknown';

    const match = raw.match(/^([a-z]{2,3}),\s*([\d.]+)$/);
    if (!match) {
      const code = /^[a-z]{2,3}$/.test(raw) ? raw : raw.split(',')[0]?.trim();
      return code && /^[a-z]{2,3}$/.test(code) ? code : 'unknown';
    }

    const [, code, confidenceStr] = match;
    const confidence = parseFloat(confidenceStr);
    if (!/^[a-z]{2,3}$/.test(code) || Number.isNaN(confidence) || confidence < CONFIDENCE_THRESHOLD) {
      return 'unknown';
    }

    return code;
  } catch {
    return 'unknown';
  }
}

/**
 * Translate text to English.
 * Skips when sourceLang is 'en'.
 * Uses cache for repeated translations.
 * On failure: returns original text (graceful fallback).
 * @param {string} text
 * @param {{ sourceLang?: string }} [options]
 * @returns {Promise<string>}
 */
export async function translateToEnglish(text, options = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return trimmed;
  }

  const { sourceLang } = options;
  if (sourceLang && ENGLISH_CODES.has(sourceLang.toLowerCase())) {
    return trimmed;
  }

  const key = cacheKey('toEn', trimmed);
  const cached = getCached(key);
  if (cached !== null) return cached;

  const client = getOpenAIClient();
  if (!client) {
    logger.warn('Translation skipped: OpenAI not configured');
    return trimmed;
  }

  const start = performance.now();
  try {
    const response = await client.chat.completions.create({
      model: TRANSLATION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Translate to English. Output only the translation, nothing else.',
        },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.2,
      max_tokens: Math.ceil(trimmed.length * 2),
    });

    const result = response.choices?.[0]?.message?.content?.trim() ?? trimmed;
    setCached(key, result);

    const processingTimeMs = Math.round(performance.now() - start);
    logger.info('Translation completed', { direction: 'toEnglish', processingTimeMs });

    return result;
  } catch (err) {
    const processingTimeMs = Math.round(performance.now() - start);
    logger.warn('Translation failed, using original', {
      direction: 'toEnglish',
      error: err.message,
      processingTimeMs,
    });
    return trimmed;
  }
}

/**
 * Translate text to target language.
 * Skips when target is English and text is already English.
 * Uses cache for repeated translations.
 * On failure: returns original text (graceful fallback).
 * @param {string} text
 * @param {string} targetLanguage - Language name or ISO code (e.g. 'Hindi', 'hi', 'Spanish')
 * @param {{ sourceLang?: string }} [options]
 * @returns {Promise<string>}
 */
export async function translateToTarget(text, targetLanguage, options = {}) {
  const trimmed = String(text ?? '').trim();
  const target = String(targetLanguage ?? '').trim();

  if (!trimmed) return '';
  if (!target) return trimmed;

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return trimmed;
  }

  const { sourceLang } = options;
  if (sourceLang && ENGLISH_CODES.has(sourceLang.toLowerCase()) && ENGLISH_CODES.has(target.toLowerCase())) {
    return trimmed;
  }

  const key = cacheKey(`to:${target}`, trimmed);
  const cached = getCached(key);
  if (cached !== null) return cached;

  const client = getOpenAIClient();
  if (!client) {
    logger.warn('Translation skipped: OpenAI not configured');
    return trimmed;
  }

  const start = performance.now();
  try {
    const response = await client.chat.completions.create({
      model: TRANSLATION_MODEL,
      messages: [
        {
          role: 'system',
          content: `Translate to ${target}. Output only the translation, nothing else.`,
        },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.2,
      max_tokens: Math.ceil(trimmed.length * 2),
    });

    const result = response.choices?.[0]?.message?.content?.trim() ?? trimmed;
    setCached(key, result);

    const processingTimeMs = Math.round(performance.now() - start);
    logger.info('Translation completed', { direction: 'toTarget', targetLanguage: target, processingTimeMs });

    return result;
  } catch (err) {
    const processingTimeMs = Math.round(performance.now() - start);
    logger.warn('Translation failed, using original', {
      direction: 'toTarget',
      targetLanguage: target,
      error: err.message,
      processingTimeMs,
    });
    return trimmed;
  }
}

export class TranslationError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'TranslationError';
    this.statusCode = 502;
    this.cause = cause;
  }
}
