import { Router } from "express";
import * as audioController from "../controllers/audioController.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadAudioRequired } from "../middleware/upload.js";

const router = Router();

/**
 * POST /audio/speech-to-text
 * Multipart: audio file (WAV, MP3, M4A). Max 25MB.
 * Returns transcript text.
 */
router.post(
  "/speech-to-text",
  protect,
  uploadAudioRequired("audio"),
  audioController.speechToText
);

/**
 * POST /audio/text-to-speech
 * Body: { text: "..." }
 * Returns URL to generated MP3 in /uploads/audio.
 */
router.post("/text-to-speech", protect, audioController.textToSpeech);

/**
 * POST /audio/synthesize/stream
 * Body: { text: "..." }
 * Streams MP3 audio directly.
 */
router.post("/synthesize/stream", protect, audioController.streamSynthesize);

export default router;
