/**
 * Text-to-speech — Deepgram Aura (speak v1).
 * Saves audio under /uploads/audio and returns a full public URL (BASE_URL + path).
 * On failure or missing config: returns null (does not throw).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { DeepgramClient, DeepgramError } from "@deepgram/sdk";
import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, "..", "uploads", "audio");
/** Aura English voice; override with DEEPGRAM_TTS_MODEL */
const DEFAULT_TTS_MODEL = "aura-2-thalia-en";

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function getDeepgramKey() {
  return process.env.DEEPGRAM_API_KEY?.trim() ?? "";
}

function getTtsModel(override) {
  if (override?.trim()) return override.trim();
  return process.env.DEEPGRAM_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
}

/**
 * Full public URL for a saved file (served as /uploads/audio/...).
 */
function buildPublicAudioUrl(fileName) {
  const base = (process.env.BASE_URL?.trim() ?? "").replace(/\/+$/, "");
  const pathSegment = `/uploads/audio/${fileName}`;
  if (!base) {
    logger.warn("BASE_URL not set; TTS URL will be path-only", { fileName });
    return pathSegment;
  }
  return `${base}${pathSegment}`;
}

/**
 * @param {string} text
 * @param {{ model?: string }} [options]
 * @returns {Promise<string|null>}
 */
async function synthesizeDeepgramToFile(text, options = {}) {
  const trimmed = text?.trim();
  if (!trimmed) {
    logger.warn("TTS skipped: empty text");
    return null;
  }

  const apiKey = getDeepgramKey();
  if (!apiKey) {
    logger.warn("TTS skipped: DEEPGRAM_API_KEY not configured");
    return null;
  }

  const model = getTtsModel(options.model);
  const fileName = `tts-${Date.now()}-${Math.round(Math.random() * 1e9)}.wav`;
  const filePath = path.join(AUDIO_DIR, fileName);

  logger.info("TTS API call start (Deepgram)", {
    provider: "deepgram",
    textLength: trimmed.length,
    model,
    fileName,
  });

  try {
    const client = new DeepgramClient({ apiKey });
    const binary = await client.speak.v1.audio.generate({
      text: trimmed,
      model,
      encoding: "linear16",
      container: "wav",
    });

    const arrayBuffer = await binary.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      logger.error("Deepgram TTS returned empty audio buffer");
      return null;
    }

    fs.writeFileSync(filePath, buffer);

    const publicUrl = buildPublicAudioUrl(fileName);

    logger.info("TTS file saved", {
      savedPath: filePath,
      returnedUrl: publicUrl,
      audioBytes: buffer.length,
    });

    return publicUrl;
  } catch (err) {
    logger.error("Deepgram TTS failed", {
      message: err.message,
      stack: err.stack,
      ...(err instanceof DeepgramError
        ? { statusCode: err.statusCode, body: err.body }
        : {}),
    });
    return null;
  }
}

/**
 * @param {string} text
 * @returns {Promise<string|null>}
 */
export async function textToSpeech(text) {
  return synthesizeDeepgramToFile(text);
}

/**
 * @param {string} text
 * @param {{ model?: string }} [options]
 * @returns {Promise<string|null>}
 */
export async function synthesize(text, options = {}) {
  return synthesizeDeepgramToFile(text, options);
}

/**
 * Stream TTS (Deepgram). Express-compatible readable stream.
 */
export async function synthesizeStream(text, options = {}) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new AppError("Text is required for synthesis", 400, "VALIDATION_ERROR");
  }

  const apiKey = getDeepgramKey();
  if (!apiKey) {
    throw new AppError("Deepgram not configured. Set DEEPGRAM_API_KEY.", 502, "TTS_NOT_CONFIGURED");
  }

  const model = getTtsModel(options.model);

  logger.info("TTS stream API call start (Deepgram)", {
    provider: "deepgram",
    textLength: trimmed.length,
    model,
  });

  const client = new DeepgramClient({ apiKey });
  const binary = await client.speak.v1.audio.generate({
    text: trimmed,
    model,
    encoding: "linear16",
    container: "wav",
  });

  const webStream = binary.stream();
  if (!webStream) {
    throw new AppError("TTS stream body missing", 502, "TTS_FAILED");
  }

  if (typeof Readable.fromWeb === "function") {
    return Readable.fromWeb(webStream, { highWaterMark: 64 * 1024 });
  }

  const buf = Buffer.from(await binary.arrayBuffer());
  return Readable.from(buf);
}

export class TTSError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "TTSError";
    this.statusCode = 502;
    this.cause = cause;
  }
}
