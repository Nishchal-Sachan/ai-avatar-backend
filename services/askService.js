/**
 * Ask service — voice/text pipeline (production).
 *
 * Flow: audio|text → Deepgram STT (if audio) → language detection → translate to EN (optional)
 *       → RAG + Groq LLM → translate output (optional) → Deepgram TTS → persist + response
 *
 * STT failures propagate as STT_FAILED. TTS failures yield audioUrl: null. RAG/LLM failures yield a safe text message.
 */

import AppError from "../utils/AppError.js";
import logger from "../config/logger.js";
import { speechToText } from "./speech.service.js";
import { textToSpeech } from "./tts.service.js";
import {
  detectLanguage,
  translateToEnglish,
  translateToTarget,
} from "./translation.service.js";
import { ask as ragAsk } from "./rag.service.js";
import { saveConversation } from "./conversationService.js";

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
};

/** User-visible copy when retrieval or generation cannot complete. */
const SAFE_RAG_OR_LLM_MESSAGE =
  "I'm sorry, I couldn't retrieve a reliable answer right now. Please try again in a moment.";

/** When the model returns no usable text after a successful RAG call. */
const SAFE_EMPTY_LLM_MESSAGE =
  "I couldn't generate a response from the available information. Try rephrasing your question.";

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code || "en";
}

async function runDetectLanguage(text, requestId) {
  const start = performance.now();
  logger.info("Ask step: detect language", { requestId });

  try {
    const detected = await detectLanguage(text);
    const lang = detected === "unknown" ? "en" : detected;
    logger.info("Ask step: language detected", {
      requestId,
      detectedLanguage: lang,
      durationMs: Math.round(performance.now() - start),
    });
    return lang;
  } catch (err) {
    logger.warn("Ask step: language detection failed, using en", {
      requestId,
      error: err.message,
    });
    return "en";
  }
}

async function runTranslateInput(text, sourceLang, requestId) {
  if (sourceLang === "en") return text;

  const start = performance.now();
  logger.info("Ask step: translate input to English", { requestId, sourceLang });

  try {
    const translated = await translateToEnglish(text, { sourceLang });
    logger.info("Ask step: input translated", {
      requestId,
      durationMs: Math.round(performance.now() - start),
    });
    return translated?.trim() || text;
  } catch (err) {
    logger.warn("Ask step: input translation failed, using original", {
      requestId,
      error: err.message,
    });
    return text;
  }
}

async function runTranslateOutput(text, targetLang, requestId) {
  if (targetLang === "en") return text;

  const start = performance.now();
  const targetName = getLanguageName(targetLang);
  logger.info("Ask step: translate output", { requestId, targetLanguage: targetName });

  try {
    const translated = await translateToTarget(text, targetName, { sourceLang: "en" });
    logger.info("Ask step: output translated", {
      requestId,
      durationMs: Math.round(performance.now() - start),
    });
    return translated?.trim() || text;
  } catch (err) {
    logger.warn("Ask step: output translation failed, using English answer", {
      requestId,
      error: err.message,
    });
    return text;
  }
}

async function runSaveConversation(params, requestId) {
  logger.info("Ask step: save conversation", { requestId });

  try {
    await saveConversation(params);
    logger.info("Ask step: conversation saved", { requestId });
  } catch (err) {
    logger.error("Ask step: save conversation failed", {
      requestId,
      error: err.message,
    });
  }
}

/**
 * Execute full ask flow.
 *
 * @param {Object} params
 * @param {string} [params.text]
 * @param {string} [params.audioFilePath]
 * @param {string} params.userId
 * @param {string} params.avatarId
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {number} [params.topK]
 * @param {string} [params.requestId]
 * @returns {Promise<{textResponse, audioUrl, detectedLanguage, responseLanguage}>}
 */
export async function executeAskFlow(params) {
  const {
    text,
    audioFilePath,
    userId,
    avatarId,
    temperature,
    maxTokens,
    topK,
    requestId = "unknown",
  } = params;

  const flowStart = performance.now();

  if (!text?.trim() && !audioFilePath) {
    throw new AppError("Provide text or audio file.", 400, "VALIDATION_ERROR");
  }

  if (!avatarId?.trim()) {
    throw new AppError("avatarId is required", 400, "VALIDATION_ERROR");
  }

  const inputType = audioFilePath ? "audio" : "text";
  logger.info("Ask pipeline: started", { requestId, inputType });

  let question;
  if (inputType === "audio") {
    question = await speechToText(audioFilePath, { deleteAfter: true });
    question = question?.trim() ?? "";
    logger.info("Ask pipeline: STT transcription", {
      requestId,
      inputType,
      transcriptionLength: question.length,
      transcriptionPreview:
        question.length > 500 ? `${question.slice(0, 500)}…` : question || "(empty)",
    });
  } else {
    question = text?.trim() ?? "";
    logger.info("Ask pipeline: text input", {
      requestId,
      inputType,
      textLength: question.length,
    });
  }

  if (!question) {
    throw new AppError("No text from input. Provide text or valid audio.", 400, "VALIDATION_ERROR");
  }

  const detectedLanguage = await runDetectLanguage(question, requestId);
  const questionEn = await runTranslateInput(question, detectedLanguage, requestId);

  let ragResult;
  let chunkCount = 0;
  try {
    ragResult = await ragAsk(questionEn, {
      userId,
      avatarId,
      temperature,
      maxTokens,
      topK,
      preferGroq: true,
    });
    chunkCount = ragResult.chunkCount ?? ragResult.chunksUsed ?? 0;
    logger.info("Ask pipeline: RAG retrieved chunks", {
      requestId,
      chunkCount,
      avatarId: avatarId.trim(),
    });
  } catch (err) {
    logger.error("Ask pipeline: RAG/LLM failure — using safe message", {
      requestId,
      error: err.message,
      code: err.code,
      stack: err.stack,
    });
    ragResult = {
      answer: SAFE_RAG_OR_LLM_MESSAGE,
      chunkCount: 0,
    };
    chunkCount = 0;
  }

  let answerEn = ragResult.answer?.trim() ?? "";
  if (!answerEn) {
    answerEn = SAFE_EMPTY_LLM_MESSAGE;
  }

  logger.info("Ask pipeline: LLM answer (English)", {
    requestId,
    chunkCount,
    llmResponseLength: answerEn.length,
  });

  const textResponse = await runTranslateOutput(answerEn, detectedLanguage, requestId);

  logger.info("Ask pipeline: final text response", {
    requestId,
    textResponseLength: textResponse.length,
  });

  const audioUrl = await textToSpeech(textResponse);

  logger.info("Ask pipeline: TTS audio URL", {
    requestId,
    audioUrl: audioUrl ?? null,
  });

  await runSaveConversation(
    {
      userId,
      question,
      questionLanguage: detectedLanguage,
      answer: textResponse,
      answerLanguage: detectedLanguage,
      audioUrl,
      executionTimeMs: Math.round(performance.now() - flowStart),
    },
    requestId,
  );

  const executionTimeMs = Math.round(performance.now() - flowStart);
  logger.info("Ask pipeline: completed", {
    requestId,
    inputType,
    transcriptionLength: question.length,
    chunkCount,
    llmResponseLength: answerEn.length,
    textResponseLength: textResponse.length,
    audioUrl: audioUrl ?? null,
    executionTimeMs,
  });

  return {
    textResponse,
    audioUrl: audioUrl ?? null,
    detectedLanguage,
    responseLanguage: detectedLanguage,
  };
}
