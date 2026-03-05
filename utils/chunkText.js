/**
 * Chunk text into 400-500 token segments with 50 token overlap.
 * Uses ~4 chars/token heuristic for English. Handles large text safely.
 */

const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 450;
const OVERLAP_TOKENS = 50;

const CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;
const STEP_CHARS = CHUNK_CHARS - OVERLAP_CHARS;

const MAX_TEXT_LENGTH = 10 * 1024 * 1024; // 10MB safety limit

/**
 * Split text into overlapping chunks of ~400-500 tokens.
 * @param {string} text - Input text (empty or very long text handled safely)
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('chunkText expects a string');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
  }

  const chunks = [];
  let start = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_CHARS, trimmed.length);
    let chunkEnd = end;
    const segment = trimmed.slice(start, end);

    const lastSpace = segment.lastIndexOf(' ');
    if (lastSpace > CHUNK_CHARS * 0.5 && end < trimmed.length) {
      chunkEnd = start + lastSpace + 1;
    }

    const chunk = trimmed.slice(start, chunkEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (chunkEnd >= trimmed.length) break;

    start = Math.max(0, chunkEnd - OVERLAP_CHARS);
  }

  return chunks;
}
