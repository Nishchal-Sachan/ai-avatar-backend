/**
 * Speech-to-text service — Deepgram (pre-recorded).
 * No caching; each request reads the given file and returns a fresh transcript.
 */

import fs, { createReadStream } from "fs";
import path from "path";
import { DeepgramClient, DeepgramError } from "@deepgram/sdk";
import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";

const STT_PROVIDER = "deepgram";

function hasDeepgramConfig() {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

function safeDeleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug("STT temp file removed", { filePath });
    }
  } catch (err) {
    logger.warn("Failed to remove STT temp file", {
      filePath,
      error: err.message,
    });
  }
}

/** @param {Record<string, unknown>} response - Deepgram prerecorded JSON body */
function extractTranscriptFromDeepgramResponse(response) {
  const channels = response?.results?.channels;
  if (!channels?.length) {
    return "";
  }
  return channels
    .map((ch) => ch.alternatives?.[0]?.transcript ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * @param {string} resolvedPath
 * @param {string} fileName
 */
async function transcribeWithDeepgram(resolvedPath, fileName) {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      "Deepgram API key not configured. Set DEEPGRAM_API_KEY.",
      503,
      "STT_FAILED",
    );
  }

  const client = new DeepgramClient({ apiKey });
  const audioStream = createReadStream(resolvedPath);

  logger.info("STT sending to Deepgram", {
    provider: STT_PROVIDER,
    fileName,
  });

  const response = await client.listen.v1.media.transcribeFile(audioStream, {
    model: "nova-3",
    smart_format: true,
  });

  const text = extractTranscriptFromDeepgramResponse(response);

  logger.info("STT transcription result", {
    provider: STT_PROVIDER,
    fileName,
    transcriptLength: text.length,
    preview: text
      ? `${text.slice(0, 80)}${text.length > 80 ? "..." : ""}`
      : "(empty)",
  });

  return text;
}

/**
 * Speech-to-text using Deepgram.
 * @param {string} filePath - Path to audio file
 * @param {{ deleteAfter?: boolean }} [options] - deleteAfter: remove file after (default true)
 * @returns {Promise<string>} Transcript
 */
export async function speechToText(filePath, options = {}) {
  const { deleteAfter = true } = options;

  if (!filePath?.trim()) {
    throw new AppError("Audio file path is required", 400, "VALIDATION_ERROR");
  }

  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new AppError("Audio file not found", 404, "FILE_NOT_FOUND");
  }

  const stats = fs.statSync(resolvedPath);
  const fileSize = stats.size;
  const fileName = path.basename(resolvedPath);

  if (fileSize === 0) {
    if (deleteAfter) safeDeleteFile(resolvedPath);
    throw new AppError("Audio file is empty", 400, "VALIDATION_ERROR");
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch (err) {
    logger.error("STT file not readable", {
      fileName,
      error: err.message,
    });
    throw new AppError("Audio file not readable", 403, "FILE_NOT_READABLE");
  }

  if (!hasDeepgramConfig()) {
    if (deleteAfter) safeDeleteFile(resolvedPath);
    logger.error("STT not configured", {
      provider: STT_PROVIDER,
      hasDeepgram: false,
    });
    throw new AppError(
      "Speech-to-text not configured. Set STT_PROVIDER=deepgram and DEEPGRAM_API_KEY.",
      503,
      "STT_FAILED",
    );
  }

  try {
    const text = await transcribeWithDeepgram(resolvedPath, fileName);
    return text ?? "";
  } catch (err) {
    if (err instanceof DeepgramError) {
      logger.error("STT Deepgram API error", {
        provider: STT_PROVIDER,
        fileName,
        message: err.message,
        statusCode: err.statusCode,
        body: err.body,
      });
    } else {
      logger.error("STT failed", {
        provider: STT_PROVIDER,
        fileName,
        error: err.message,
      });
    }

    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("Speech-to-text failed", 500, "STT_FAILED");
  } finally {
    if (deleteAfter) {
      safeDeleteFile(resolvedPath);
    }
  }
}

/**
 * @deprecated Use speechToText. Kept for backward compatibility.
 */
export async function transcribe(audioFilePath, options = {}) {
  return speechToText(audioFilePath, options);
}

export class SpeechError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "SpeechError";
    this.statusCode = 502;
    this.cause = cause;
  }
}
