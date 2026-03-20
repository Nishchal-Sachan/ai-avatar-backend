/**
 * Chunk text into 400-500 token segments with 50 token overlap.
 * Uses ~4 chars/token heuristic for English.
 */

const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 450; // Center of 400-500 range
const OVERLAP_TOKENS = 50;

const CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN; // 1800 chars
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // 200 chars
const STEP_CHARS = CHUNK_CHARS - OVERLAP_CHARS; // 1600 chars per step

const MAX_TEXT_LENGTH = 10 * 1024 * 1024; // 10MB safety limit

/**
 * Split text into overlapping chunks of ~400-500 tokens (50 token overlap).
 * @param {string} text - Input text
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text) {
  if (typeof text !== "string") {
    throw new TypeError("chunkText expects a string");
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

    // Break at word boundary when possible (avoid mid-word cuts)
    const lastSpace = segment.lastIndexOf(" ");
    if (lastSpace > CHUNK_CHARS * 0.5 && end < trimmed.length) {
      chunkEnd = start + lastSpace + 1;
    }

    const chunk = trimmed.slice(start, chunkEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (chunkEnd >= trimmed.length) break;

    // Next start: step back by overlap to create 50-token overlap
    start = Math.max(0, chunkEnd - OVERLAP_CHARS);
  }

  return chunks;
}
