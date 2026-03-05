/**
 * Audio controller - TTS streaming.
 */

import { synthesizeStream, TTSError } from '../services/tts.service.js';

/**
 * POST /api/v1/audio/synthesize/stream
 * Body: { text: "..." }
 * Response: Streamed MP3 audio (application/octet-stream)
 */
export async function streamSynthesize(req, res, next) {
  try {
    const text = req.body?.text?.trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        error: { message: 'Text is required for synthesis.' },
      });
    }

    const stream = await synthesizeStream(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    stream.pipe(res);
    stream.on('error', (err) => next(err));
    res.on('close', () => {
      if (!stream.destroyed) stream.destroy();
    });
  } catch (err) {
    if (err instanceof TTSError) {
      return res.status(err.statusCode || 502).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
}
