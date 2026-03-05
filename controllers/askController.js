/**
 * Ask controller - orchestrates only. Delegates to askService.
 * Returns structured response with metadata and request tracing.
 */

import { executeAskFlow } from '../services/askService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, error } from '../utils/responseFormatter.js';

/**
 * POST /api/v1/ask
 * Body: { text: "..." } or multipart with audio file
 */
export const ask = asyncHandler(async (req, res) => {
  const text = req.body?.text?.trim();
  const audioFilePath = req.file?.path;

  if (!text && !audioFilePath) {
    return error(res, 'Provide text or audio file.', { status: 400, requestId: req.requestId });
  }

  const result = await executeAskFlow({
    text,
    audioFilePath,
    userId: req.user.id.toString(),
    avatarId: req.body?.avatarId?.trim(),
    temperature: req.body?.temperature != null ? Number(req.body.temperature) : undefined,
    maxTokens: req.body?.maxTokens != null ? parseInt(req.body.maxTokens, 10) : undefined,
    topK: req.body?.topK != null ? parseInt(req.body.topK, 10) : undefined,
    streamAudio: req.body?.streamAudio === true,
    requestId: req.requestId,
  });

  success(res, {
    textResponse: result.answer,
    audioUrl: result.audioUrl ?? null,
    streamAudioEndpoint: result.streamAudioEndpoint ?? null,
    detectedLanguage: result.detectedLanguage ?? result.questionLanguage,
    responseLanguage: result.responseLanguage ?? result.answerLanguage,
    emotion: result.emotion ?? 'neutral',
    question: result.question,
  }, {
    metadata: {
      requestId: req.requestId,
      executionTime: result.executionTimeMs,
      tokenUsage: result.totalTokens ?? result.usage ?? 0,
      chunkCount: result.chunkCount ?? result.chunksUsed ?? 0,
      timing: result.timing,
    },
  });
});
