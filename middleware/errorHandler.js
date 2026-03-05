/**
 * Centralized error middleware.
 * Returns a structured error response in all environments.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const response = {
    success: false,
    error: {
      message,
      ...(req.requestId && { requestId: req.requestId }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  if (err.name === 'ValidationError') {
    response.error.message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
    response.error.details = err.errors;
  }

  if (err.code === 11000) {
    response.error.message = 'Duplicate field value. Resource already exists.';
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    response.error.message = 'File size exceeds 5MB limit.';
  }

  if (
    err.name === 'EmbeddingGenerationError' ||
    err.name === 'VectorStoreError' ||
    err.name === 'LLMCompletionError' ||
    err.name === 'SpeechError' ||
    err.name === 'TTSError' ||
    err.name === 'TranslationError'
  ) {
    response.error.message = err.message;
    if (err.statusCode) statusCode = err.statusCode;
  }

  if (err.message === 'CORS not allowed') {
    statusCode = 403;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
