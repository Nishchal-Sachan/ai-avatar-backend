/**
 * Audio controller - STT and TTS.
 */

import { transcribe } from "../services/speech.service.js";
import { synthesize, synthesizeStream } from "../services/tts.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

/**
 * POST /api/v1/audio/speech-to-text
 * Multipart: audio file (required)
 * Response: { text: "..." }
 */
export const speechToText = asyncHandler(async (req, res) => {
  if (!req.file?.path) {
    throw new AppError("No audio file provided.", 400, "VALIDATION_ERROR");
  }

  const text = await transcribe(req.file.path, { deleteAfter: true });

  res.json({
    success: true,
    data: { text },
  });
});

/**
 * POST /api/v1/audio/text-to-speech
 * Body: { text: "..." }
 * Response: { url: "/uploads/audio/xxx.mp3" }
 */
export const textToSpeech = asyncHandler(async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) {
    throw new AppError("Text is required for synthesis.", 400, "VALIDATION_ERROR");
  }

  const url = await synthesize(text);

  res.json({
    success: true,
    data: { url },
  });
});

/**
 * POST /api/v1/audio/synthesize/stream
 * Body: { text: "..." }
 * Response: Streamed MP3 audio (application/octet-stream)
 */
export const streamSynthesize = asyncHandler(async (req, res, next) => {
  const text = req.body?.text?.trim();
  if (!text) {
    return next(new AppError("Text is required for synthesis.", 400, "VALIDATION_ERROR"));
  }

  const stream = await synthesizeStream(text);
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Transfer-Encoding", "chunked");
  stream.pipe(res);
  stream.on("error", (err) => next(err));
  res.on("close", () => {
    if (!stream.destroyed) stream.destroy();
  });
});
