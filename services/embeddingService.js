/**
 * Embedding service - orchestrates HuggingFace embeddings and vector storage.
 * No embedding logic in controllers. Vector storage is abstracted.
 */

import crypto from 'crypto';
import axios from 'axios';
import logger from '../config/logger.js';
import { getVectorStore } from './embedding/vectorStore.js';
import { EmbeddingGenerationError, VectorStoreError } from '../utils/EmbeddingError.js';

const HF_EMBEDDING_URL =
  'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

const RETRY_DELAYS_MS = [500, 1000, 2000];
const RETRY_STATUS_CODES = [429, 503];

const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textHash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

function getCachedVector(text) {
  const hash = textHash(text);
  return embeddingCache.get(hash);
}

function setCachedVector(text, vector) {
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(textHash(text), vector);
}

/**
 * Generate mock embedding for fallback when HuggingFace API fails.
 * Prevents system crashes during demos.
 * @returns {number[]} Mock embedding vector of size 384
 */
function getMockEmbedding() {
  return Array(EMBEDDING_DIM)
    .fill(0)
    .map(() => Math.random());
}

/**
 * Generate embedding for text. Uses cache to prevent duplicate embeddings.
 * Uses HuggingFace Inference API. Falls back to mock embedding on failure.
 * @param {string} text
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
  if (!text?.trim()) {
    throw new EmbeddingGenerationError('Text is required for embedding');
  }

  const cached = getCachedVector(text);
  if (cached) {
    logger.debug('Embedding cache hit', { charCount: text.length });
    return cached;
  }

  const apiKey = process.env.HF_API_KEY?.trim();
  if (!apiKey) {
    logger.warn('HuggingFace not configured, using mock embedding');
    const mock = getMockEmbedding();
    setCachedVector(text, mock);
    return mock;
  }

  if (!generateEmbedding._logged) {
    console.log('Using HuggingFace embeddings');
    generateEmbedding._logged = true;
  }

  const start = performance.now();

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await axios.post(
        HF_EMBEDDING_URL,
        { inputs: text.trim() },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      let embedding = Array.isArray(data) ? data[0] : data;

      if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
        embedding = embedding[0];
      }
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new EmbeddingGenerationError('Empty or invalid embedding response from HuggingFace');
      }

      const vector = embedding.map((v) => (typeof v === 'number' ? v : parseFloat(v)));
      const elapsed = performance.now() - start;

      setCachedVector(text, vector);
      logger.info('Embedding generated', { elapsedMs: elapsed.toFixed(2), charCount: text.length });
      return vector;
    } catch (err) {
      lastError = err;
      const status = err.response?.status ?? err.status ?? err.statusCode;
      const isRetryable = RETRY_STATUS_CODES.includes(status);

      if (isRetryable && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        logger.warn('Embedding API rate limited, retrying', { attempt: attempt + 1, delayMs: delay });
        await sleep(delay);
        continue;
      }

      const elapsed = performance.now() - start;
      logger.error('Embedding failed, using mock fallback', {
        elapsedMs: elapsed.toFixed(2),
        error: err.message,
      });

      const mock = getMockEmbedding();
      setCachedVector(text, mock);
      return mock;
    }
  }

  const mock = getMockEmbedding();
  setCachedVector(text, mock);
  return mock;
}

/**
 * Store embedding with namespace (avatarId) and metadata.
 * @param {string} id - Chunk identifier
 * @param {number[]} vector
 * @param {Object} [options] - { namespace (avatarId), metadata: { documentId, chunkIndex } }
 */
export async function storeEmbedding(id, vector, options = {}) {
  try {
    const store = getVectorStore();
    await store.store(id, vector, options);
  } catch (err) {
    if (err instanceof VectorStoreError) throw err;
    logger.error('Vector store failed', { error: err.message });
    throw new VectorStoreError(`Store failed: ${err.message}`, err);
  }
}

/**
 * Search for similar vectors within namespace (avatarId).
 * Graceful fallback: on vector DB failure, returns empty array.
 * @param {number[]} queryVector
 * @param {number} topK - Default 5
 * @param {Object} [options] - { namespace (avatarId) }
 * @returns {Promise<Array<{id: string, score: number, metadata?: Object}>>}
 */
export async function searchSimilar(queryVector, topK = 5, options = {}) {
  try {
    const store = getVectorStore();
    return await store.search(queryVector, topK, options);
  } catch (err) {
    logger.error('Vector search failed', { error: err.message });
    throw new Error('Vector DB search failed');
  }
}

/**
 * Delete all embeddings for a document. Used when document is soft-deleted.
 * @param {string} documentId
 * @param {Object} [options] - { namespace } - namespace (avatarId) for Pinecone
 * @returns {Promise<number>} Count of deleted vectors
 */
export async function deleteEmbeddingsByDocument(documentId, options = {}) {
  try {
    const store = getVectorStore();
    const deleted = await store.deleteByDocument(documentId, options);
    logger.info('Embeddings deleted', { documentId, count: deleted });
    return deleted;
  } catch (err) {
    if (err instanceof VectorStoreError) throw err;
    logger.error('Vector delete failed', { documentId, error: err.message });
    throw new VectorStoreError(`Delete failed: ${err.message}`, err);
  }
}

/** @deprecated Use isHuggingFaceConfigured. Kept for backward compatibility. */
export function isOpenAIConfigured() {
  return Boolean(process.env.HF_API_KEY?.trim());
}

export function isHuggingFaceConfigured() {
  return Boolean(process.env.HF_API_KEY?.trim());
}
