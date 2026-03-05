/**
 * Text-to-speech service - ElevenLabs.
 * Sends text to ElevenLabs, receives MP3, stores in /uploads/audio, returns public URL.
 * On failure: throws TTSError. Caller should return text-only response gracefully.
 * Supports streaming via synthesizeStream().
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');
const ELEVENLABS_BASE = 'https://api.elevenlabs.io';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const OUTPUT_FORMAT = 'mp3_44100_128';

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * @param {string} text - Text to convert to speech
 * @param {{ voiceId?: string }} [options]
 * @returns {Promise<string>} Public URL to the stored MP3 (e.g. /uploads/audio/filename.mp3)
 */
export async function synthesize(text, options = {}) {
  const start = performance.now();
  const { voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID } = options;

  if (!text?.trim()) {
    throw new TTSError('Text is required for synthesis');
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new TTSError('ElevenLabs is not configured. Set ELEVENLABS_API_KEY.');
  }

  const url = `${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
      }),
    });
  } catch (err) {
    throw new TTSError(`ElevenLabs request failed: ${err.message}`, err);
  }

  if (!response.ok) {
    const body = await response.text();
    let message = `ElevenLabs API error (${response.status})`;
    try {
      const json = JSON.parse(body);
      message = json.detail?.[0]?.msg || json.message || message;
    } catch {
      if (body) message += `: ${body.slice(0, 200)}`;
    }
    throw new TTSError(message, new Error(body));
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const audioSizeBytes = buffer.length;
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);

  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    throw new TTSError(`Failed to save audio: ${err.message}`, err);
  }

  const processingTimeMs = Math.round(performance.now() - start);
  logger.info('TTS completed', { audioSizeBytes, processingTimeMs });

  return `/uploads/audio/${filename}`;
}

/**
 * Stream TTS audio from ElevenLabs. Returns audio chunks as they arrive.
 * Use for low-latency streaming to clients.
 * @param {string} text - Text to convert to speech
 * @param {{ voiceId?: string }} [options]
 * @returns {Promise<Readable>} Node.js Readable stream of MP3 audio
 */
export async function synthesizeStream(text, options = {}) {
  const start = performance.now();
  const { voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID } = options;

  if (!text?.trim()) {
    throw new TTSError('Text is required for synthesis');
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new TTSError('ElevenLabs is not configured. Set ELEVENLABS_API_KEY.');
  }

  const url = `${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}/stream?output_format=${OUTPUT_FORMAT}&optimize_streaming_latency=2`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: 'eleven_multilingual_v2',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `ElevenLabs API error (${response.status})`;
    try {
      const json = JSON.parse(body);
      message = json.detail?.[0]?.msg || json.message || message;
    } catch {
      if (body) message += `: ${body.slice(0, 200)}`;
    }
    throw new TTSError(message, new Error(body));
  }

  const webStream = response.body;
  if (!webStream) {
    throw new TTSError('No response body from ElevenLabs');
  }

  const nodeStream = Readable.fromWeb(webStream);
  let totalBytes = 0;
  nodeStream.on('data', (chunk) => {
    totalBytes += chunk.length;
  });
  nodeStream.on('end', () => {
    const processingTimeMs = Math.round(performance.now() - start);
    logger.info('TTS stream completed', { audioSizeBytes: totalBytes, processingTimeMs });
  });

  return nodeStream;
}

export class TTSError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'TTSError';
    this.statusCode = 502;
    this.cause = cause;
  }
}
