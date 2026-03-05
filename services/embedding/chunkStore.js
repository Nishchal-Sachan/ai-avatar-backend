/**
 * Chunk text store - maps chunk IDs to text and metadata.
 * Used by RAG for retrieval. In-memory by default; swap for MongoDB when needed.
 */

const store = new Map();

export function getChunksByIds(ids) {
  return ids
    .map((id) => {
      const entry = store.get(String(id));
      return entry ? { id: String(id), text: entry.text, metadata: entry.metadata } : null;
    })
    .filter(Boolean);
}

/**
 * @param {string} id
 * @param {string} text
 * @param {Object} [metadata] - { avatarId, documentId, chunkIndex }
 */
export function storeChunk(id, text, metadata = {}) {
  store.set(String(id), { text, metadata });
}

/**
 * Delete all chunks for a document. Used when document is soft-deleted.
 * @param {string} documentId
 * @returns {number} Count of deleted chunks
 */
export function deleteChunksByDocument(documentId) {
  let deleted = 0;
  for (const [id, entry] of store) {
    if (entry.metadata?.documentId === String(documentId)) {
      store.delete(id);
      deleted++;
    }
  }
  return deleted;
}
