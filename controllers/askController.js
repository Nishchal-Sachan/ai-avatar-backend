/**
 * Ask controller — delegates to askService (no business logic here).
 *
 * Voice pipeline: multipart audio → Deepgram STT → RAG (Groq) → Deepgram TTS → JSON
 * Text pipeline: body.text → RAG (Groq) → Deepgram TTS → JSON
 */

import { executeAskFlow } from "../services/askService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

/**
 * POST /api/v1/ask
 * Body (JSON or multipart): text?, audio file field "audio", avatarId (required), temperature?, maxTokens?, topK?
 * Returns: { success, data: { textResponse, audioUrl, detectedLanguage, responseLanguage } }
 *
 * Errors: STT_FAILED from speech service; validation if neither text nor audio or missing avatarId.
 */
export const ask = asyncHandler(async (req, res) => {
  const text = req.body?.text?.trim();
  const audioFilePath = req.file?.path;
  const avatarId = req.body?.avatarId?.trim();

  if (!text && !audioFilePath) {
    throw new AppError("Provide text or audio file.", 400, "VALIDATION_ERROR");
  }

  if (!avatarId) {
    throw new AppError("avatarId is required", 400, "VALIDATION_ERROR");
  }

  const result = await executeAskFlow({
    text,
    audioFilePath,
    userId: req.user.id.toString(),
    avatarId,
    temperature: req.body?.temperature != null ? Number(req.body.temperature) : undefined,
    maxTokens: req.body?.maxTokens != null ? parseInt(req.body.maxTokens, 10) : undefined,
    topK: req.body?.topK != null ? parseInt(req.body.topK, 10) : undefined,
    requestId: req.requestId,
  });

  res.json({
    success: true,
    data: {
      textResponse: result.textResponse,
      audioUrl: result.audioUrl,
      detectedLanguage: result.detectedLanguage,
      responseLanguage: result.responseLanguage,
    },
  });
});
