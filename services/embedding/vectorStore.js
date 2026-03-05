/**
 * Abstracted vector storage.
 * Uses Pinecone when configured; falls back to mock in-memory store otherwise.
 * Namespace = avatarId for per-avatar isolation.
 */

import { VectorStoreError } from '../../utils/EmbeddingError.js';

const EMBEDDING_MODEL_DIMENSIONS = 384;
const DEFAULT_NAMESPACE = 'default';

const mockStore = new Map();

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function nsKey(namespace, id) {
  return `${namespace || DEFAULT_NAMESPACE}:${id}`;
}

function isPineconeConfigured() {
  return Boolean(process.env.PINECONE_API_KEY?.trim() && process.env.PINECONE_INDEX?.trim());
}

/**
 * Mock vector store - in-memory when Pinecone not configured.
 */
export const mockVectorStore = {
  async store(id, vector, options = {}) {
    const { namespace = DEFAULT_NAMESPACE, metadata = {} } = options;

    if (!Array.isArray(vector) || vector.length !== EMBEDDING_MODEL_DIMENSIONS) {
      throw new VectorStoreError('Invalid vector dimensions');
    }

    const key = nsKey(namespace, id);
    mockStore.set(key, {
      vector: [...vector],
      metadata: {
        avatarId: namespace,
        documentId: metadata.documentId,
        chunkIndex: metadata.chunkIndex,
        text: metadata.text,
      },
    });
  },

  async search(queryVector, topK = 5, options = {}) {
    const { namespace = DEFAULT_NAMESPACE } = options;

    if (!Array.isArray(queryVector)) {
      throw new VectorStoreError('Query must be a vector array');
    }

    const ns = namespace || DEFAULT_NAMESPACE;
    const prefix = `${ns}:`;
    const results = [];

    for (const [key, entry] of mockStore) {
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      const score = cosineSimilarity(queryVector, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },

  async deleteByDocument(documentId, options = {}) {
    const { namespace = DEFAULT_NAMESPACE } = options;
    const toDelete = [];
    const prefix = `${namespace || DEFAULT_NAMESPACE}:`;
    for (const [key, entry] of mockStore) {
      if (!key.startsWith(prefix)) continue;
      if (entry.metadata?.documentId === String(documentId)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => mockStore.delete(k));
    return toDelete.length;
  },
};

/**
 * Get Pinecone index. Lazy-loaded to avoid errors when env vars are missing.
 */
async function getPineconeIndex() {
  const { getPineconeIndex: getIndex } = await import('../../config/pinecone.js');
  return getIndex();
}

/**
 * Pinecone vector store - real cloud storage.
 */
export const pineconeVectorStore = {
  async store(id, vector, options = {}) {
    const { namespace = DEFAULT_NAMESPACE, metadata = {} } = options;

    if (!Array.isArray(vector) || vector.length !== EMBEDDING_MODEL_DIMENSIONS) {
      throw new VectorStoreError('Invalid vector dimensions');
    }

    try {
      const index = await getPineconeIndex();
      await index.upsert({
        records: [
          {
            id: String(id),
            values: vector,
            metadata: {
              text: String(metadata.text ?? ''),
              avatarId: String(namespace || DEFAULT_NAMESPACE),
              documentId: String(metadata.documentId ?? ''),
              chunkIndex: Number(metadata.chunkIndex ?? 0),
            },
          },
        ],
        namespace: namespace || DEFAULT_NAMESPACE,
      });
    } catch (err) {
      throw new VectorStoreError(`Pinecone store failed: ${err.message}`, err);
    }
  },

  async search(queryVector, topK = 5, options = {}) {
    const { namespace = DEFAULT_NAMESPACE } = options;

    if (!Array.isArray(queryVector)) {
      throw new VectorStoreError('Query must be a vector array');
    }

    try {
      const index = await getPineconeIndex();
      const result = await index.query({
        vector: queryVector,
        topK,
        includeMetadata: true,
        namespace: namespace || DEFAULT_NAMESPACE,
      });

      return (result.matches ?? []).map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: match.metadata ?? {},
      }));
    } catch (err) {
      throw new Error('Vector DB search failed');
    }
  },

  async deleteByDocument(documentId, options = {}) {
    const { namespace = DEFAULT_NAMESPACE } = options;

    try {
      const index = await getPineconeIndex();
      await index.deleteMany({
        filter: {
          documentId: { $eq: String(documentId) },
        },
        namespace: namespace || DEFAULT_NAMESPACE,
      });
      return 1;
    } catch (err) {
      throw new VectorStoreError(`Pinecone delete failed: ${err.message}`, err);
    }
  },
};

export function getVectorStore() {
  return isPineconeConfigured() ? pineconeVectorStore : mockVectorStore;
}
