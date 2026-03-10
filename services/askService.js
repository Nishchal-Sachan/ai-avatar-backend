/**
 * Ask service - orchestrates the full ask flow.
 * Services remain independent; this layer coordinates them.
 * Tracks execution time breakdown, emotion, partial failures.
 */

import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { transcribe } from './speech.service.js';
import { detectLanguage, translateToEnglish, translateToTarget } from './translation.service.js';
import { ask as ragAsk } from './rag.service.js';
import { synthesize } from './tts.service.js';
import { analyzeEmotion } from './emotion.service.js';
import { saveConversation } from './conversationService.js';

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
};

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * @param {Object} params
 * @param {string} [params.text] - Question as text
 * @param {string} [params.audioFilePath] - Path to audio file (STT will be used)
 * @param {string} params.userId
 * @param {string} [params.avatarId] - For RAG namespace and avatar-scoped search
 * @param {number} [params.temperature] - RAG/LLM temperature
 * @param {number} [params.maxTokens] - RAG/LLM max tokens
 * @param {number} [params.topK] - RAG retrieval topK
 * @param {boolean} [params.streamAudio] - If true, skip TTS and return streamAudioEndpoint for client to fetch audio
 * @param {string} [params.requestId] - Request ID for tracing
 */
export async function executeAskFlow(params) {
  const { text, audioFilePath, userId, avatarId, temperature, maxTokens, topK, streamAudio, requestId } = params;
  const flowStart = performance.now();

  const timing = {
    sttTimeMs: 0,
    translationTimeMs: 0,
    retrievalTimeMs: 0,
    llmTimeMs: 0,
    ttsTimeMs: 0,
    emotionTimeMs: 0,
  };

  if (!text?.trim() && !audioFilePath) {
    throw new AppError('Either text or audio must be provided', 400, 'VALIDATION_ERROR');
  }

  let question = text?.trim() ?? '';

  if (audioFilePath) {
    const sttStart = performance.now();
    question = await transcribe(audioFilePath);
    timing.sttTimeMs = Math.round(performance.now() - sttStart);
  }

  if (!question) {
    throw new AppError('Either text or audio must be provided', 400, 'VALIDATION_ERROR');
  }

  const detectedLang = await detectLanguage(question);
  const questionLang = detectedLang === 'unknown' ? 'en' : detectedLang;

  let questionEn = question;
  let translationTimeMs = 0;
  if (questionLang !== 'en') {
    const t0 = performance.now();
    questionEn = await translateToEnglish(question, { sourceLang: detectedLang });
    translationTimeMs += performance.now() - t0;
  }

  const ragResult = await ragAsk(questionEn, {
    userId,
    avatarId,
    temperature,
    maxTokens,
    topK,
  });
  const answerEn = ragResult.answer;

  const targetLang = getLanguageName(questionLang);
  let answer = answerEn;
  if (questionLang !== 'en' && targetLang) {
    const t0 = performance.now();
    answer = await translateToTarget(answerEn, targetLang, { sourceLang: 'en' });
    translationTimeMs += performance.now() - t0;
  }
  timing.translationTimeMs = Math.round(translationTimeMs);
  timing.retrievalTimeMs = ragResult.retrievalTimeMs ?? 0;
  timing.llmTimeMs = ragResult.llmTimeMs ?? 0;

  const emotionStart = performance.now();
  const emotion = await analyzeEmotion(answer);
  timing.emotionTimeMs = Math.round(performance.now() - emotionStart);

  let audioUrl = null;
  let streamAudioEndpoint = null;

  if (streamAudio) {
    streamAudioEndpoint = '/api/v1/audio/synthesize/stream';
  } else {
    try {
      const ttsStart = performance.now();
      audioUrl = await synthesize(answer);
      timing.ttsTimeMs = Math.round(performance.now() - ttsStart);
    } catch (err) {
      logger.warn('TTS failed, returning text only', { requestId, error: err.message });
    }
  }

  const executionTimeMs = Math.round(performance.now() - flowStart);
  logger.info('Ask flow completed', {
    requestId,
    executionTimeMs,
    ...timing,
  });

  try {
    await saveConversation({
      userId,
      question,
      questionLanguage: questionLang,
      answer,
      answerLanguage: questionLang,
      audioUrl,
      executionTimeMs,
    });
  } catch (err) {
    logger.error('Failed to save conversation', { requestId, error: err.message });
  }

  return {
    question,
    questionLanguage: questionLang,
    answer,
    answerLanguage: questionLang,
    audioUrl,
    streamAudioEndpoint: streamAudioEndpoint || undefined,
    detectedLanguage: questionLang,
    responseLanguage: questionLang,
    emotion,
    executionTimeMs,
    timing,
    chunksUsed: ragResult.chunksUsed ?? ragResult.chunkCount ?? 0,
    chunkCount: ragResult.chunkCount ?? ragResult.chunksUsed ?? 0,
    usage: ragResult.usage,
    totalTokens: ragResult.totalTokens ?? ragResult.usage,
  };
}
