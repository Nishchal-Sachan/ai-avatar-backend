/**
 * Embedding-specific errors for clean error isolation.
 */
export class EmbeddingError extends Error {
  constructor(message, statusCode = 502, cause = null) {
    super(message);
    this.name = 'EmbeddingError';
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export class EmbeddingGenerationError extends EmbeddingError {
  constructor(message, cause = null) {
    super(message, 502, cause);
    this.name = 'EmbeddingGenerationError';
  }
}

export class VectorStoreError extends EmbeddingError {
  constructor(message, cause = null) {
    super(message, 502, cause);
    this.name = 'VectorStoreError';
  }
}

export class LLMCompletionError extends EmbeddingError {
  constructor(message, cause = null) {
    super(message, 502, cause);
    this.name = 'LLMCompletionError';
  }
}
