/**
 * Centralized error middleware.
 * Returns a structured error response in all environments.
 * Logs full stack for production debugging.
 */
import logger from "../config/logger.js";

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(". ");
  }

  if (err.code === 11000) {
    message = "Duplicate field value. Resource already exists.";
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    message = "File size exceeds 5MB limit.";
  }

  if (
    err.name === "EmbeddingGenerationError" ||
    err.name === "VectorStoreError" ||
    err.name === "LLMCompletionError" ||
    err.name === "SpeechError" ||
    err.name === "TTSError" ||
    err.name === "TranslationError"
  ) {
    message = err.message;
  }

  if (err.message === "CORS not allowed") {
    message = "CORS not allowed";
  }

  const finalStatus =
    err.name === "ValidationError" ? 400
    : err.code === 11000 ? 409
    : err.code === "LIMIT_FILE_SIZE" ? 400
    : err.message === "CORS not allowed" ? 403
    : (err.statusCode || 500);

  logger.error("Request error", {
    message: err.message,
    statusCode: finalStatus,
    requestId: req.requestId,
    path: req.path,
    stack: err.stack,
  });

  const response = {
    success: false,
    error: {
      message,
      ...(req.requestId && { requestId: req.requestId }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  };

  if (err.name === "ValidationError" && err.errors) {
    response.error.details = err.errors;
  }

  res.status(finalStatus).json(response);
};

export default errorHandler;
