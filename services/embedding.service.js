/**
 * Embedding service - generate embeddings, store vectors, search similar.
 * Primary: OpenAI. Fallback: mock embeddings on failure.
 * Embeddings stored per document, linked to avatarId (namespace).
 */

import logger from "../config/logger.js";
import { getOpenAIClient } from "../config/openai.js";
import { getVectorStore } from "./embedding/vectorStore.js";

const EMBEDDING_DIM = 384;
const OPENAI_MODEL = "text-embedding-3-small";

/**
 * Generate mock embedding for fallback when OpenAI fails.
 * @returns {number[]} Mock vector of EMBEDDING_DIM
 */
function getMockEmbedding() {
  return Array(EMBEDDING_DIM)
    .fill(0)
    .map(() => Math.random() * 2 - 1);
}

/**
 * Generate embedding for text.
 * Uses OpenAI when configured; falls back to mock on failure.
 * @param {string} text
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
  if (!text?.trim()) {
    throw new Error("Text is required for embedding");
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.embeddings.create({
        model: OPENAI_MODEL,
        input: text.trim(),
        dimensions: EMBEDDING_DIM,
      });
      const embedding = response.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Empty embedding response");
      }
      return embedding.map((v) => (typeof v === "number" ? v : parseFloat(v)));
    } catch (err) {
      logger.warn("OpenAI embedding failed, using mock fallback", {
        error: err.message,
      });
      return getMockEmbedding();
    }
  }

  logger.debug("OpenAI not configured, using mock embedding");
  return getMockEmbedding();
}

/**
 * Store embedding with document and avatarId metadata.
 * @param {string} id - Chunk identifier (e.g. documentId-chunkIndex)
 * @param {number[]} vector
 * @param {Object} [options] - { namespace (avatarId), metadata: { documentId, chunkIndex, text } }
 */
export async function storeEmbedding(id, vector, options = {}) {
  const store = getVectorStore();
  await store.store(id, vector, options);
}

/**
 * Search for similar vectors. Filters by avatarId (namespace).
 * @param {number[]} queryVector - Query embedding
 * @param {number} [topK=5] - Number of results
 * @param {Object} [options] - { namespace (avatarId) }
 * @returns {Promise<Array<{id: string, score: number, metadata?: Object}>>}
 */
export async function searchSimilar(queryVector, topK = 5, options = {}) {
  const store = getVectorStore();
  return store.search(queryVector, topK, options);
}

/**
 * Delete all embeddings for a document within namespace.
 * @param {string} documentId
 * @param {Object} [options] - { namespace (avatarId) }
 */
export async function deleteEmbeddingsByDocument(documentId, options = {}) {
  const store = getVectorStore();
  return store.deleteByDocument(documentId, options);
}
