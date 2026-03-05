/**
 * Emotion tagging - analyzes response tone.
 * Returns: neutral, positive, or serious.
 */

import { getOpenAIClient } from '../config/openai.js';
import logger from '../config/logger.js';

const VALID_EMOTIONS = new Set(['neutral', 'positive', 'serious']);
const DEFAULT_EMOTION = 'neutral';

/**
 * Analyze text tone. Returns emotion: neutral, positive, or serious.
 * On failure: returns 'neutral'.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function analyzeEmotion(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return DEFAULT_EMOTION;

  const client = getOpenAIClient();
  if (!client) return DEFAULT_EMOTION;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Classify the emotional tone of the text. Reply with only one word: neutral, positive, or serious. No other text.',
        },
        { role: 'user', content: trimmed.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const raw = response.choices?.[0]?.message?.content?.trim()?.toLowerCase();
    const emotion = raw && VALID_EMOTIONS.has(raw) ? raw : DEFAULT_EMOTION;
    return emotion;
  } catch (err) {
    logger.warn('Emotion analysis failed', { error: err.message });
    return DEFAULT_EMOTION;
  }
}
