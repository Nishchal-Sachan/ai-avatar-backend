/**
 * Speech-to-text service - OpenAI Whisper.
 * Accepts audio file, returns transcript. Cleans up temp files.
 */

import fs from 'fs';
import path from 'path';
import { getOpenAIClient } from '../config/openai.js';
import logger from '../config/logger.js';

const WHISPER_MODEL = 'whisper-1';
const MAX_DURATION_SECONDS = 60;

function safeDeleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Temp file removed', { filePath });
    }
  } catch (err) {
    logger.warn('Failed to remove temp file', { filePath, error: err.message });
  }
}

/**
 * @param {string} audioFilePath - Path to audio file (e.g. from multer)
 * @param {{ deleteAfter?: boolean }} [options] - deleteAfter: remove file after transcription (default true)
 * @returns {Promise<string>} Transcript
 */
export async function transcribe(audioFilePath, options = {}) {
  const { deleteAfter = true } = options;

  if (!audioFilePath?.trim()) {
    throw new SpeechError('Audio file path is required');
  }

  const resolvedPath = path.resolve(audioFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new SpeechError('Audio file not found');
  }

  const fileStats = fs.statSync(resolvedPath);
  const audioSizeBytes = fileStats.size;

  const client = getOpenAIClient();
  if (!client) {
    safeDeleteFile(resolvedPath);
    throw new SpeechError('OpenAI is not configured. Set OPENAI_API_KEY.');
  }

  try {
    const { parseFile } = await import('music-metadata');
    const metadata = await parseFile(resolvedPath);
    const durationSeconds = metadata.format?.duration ?? 0;

    if (durationSeconds > MAX_DURATION_SECONDS) {
      safeDeleteFile(resolvedPath);
      throw new SpeechError(
        `Audio exceeds maximum duration of ${MAX_DURATION_SECONDS} seconds.`
      );
    }
  } catch (err) {
    if (err instanceof SpeechError) throw err;
    logger.warn('Could not parse audio duration, proceeding', { error: err.message });
  }

  const start = performance.now();

  try {
    const stream = fs.createReadStream(resolvedPath);

    const transcription = await client.audio.transcriptions.create({
      file: stream,
      model: WHISPER_MODEL,
    });

    const transcript = transcription?.text?.trim() ?? '';
    const processingTimeMs = Math.round(performance.now() - start);

    logger.info('STT completed', {
      audioSizeBytes,
      processingTimeMs,
    });

    return transcript;
  } catch (err) {
    const status = err.status ?? err.statusCode;
    if (status === 401) {
      throw new SpeechError('Invalid OpenAI API key', err);
    }
    if (status === 429) {
      throw new SpeechError('OpenAI rate limit exceeded', err);
    }
    throw new SpeechError(err.message || 'Transcription failed', err);
  } finally {
    if (deleteAfter) {
      safeDeleteFile(resolvedPath);
    }
  }
}

export class SpeechError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'SpeechError';
    this.statusCode = 502;
    this.cause = cause;
  }
}
