/**
 * Global error middleware.
 * Status code mapping:
 * 400 → validation
 * 401 → auth
 * 403 → forbidden
 * 404 → not found
 * 500 → server error
 *
 * Response format: { success: false, error: { code, message } }
 * Validation errors: NO stack traces.
 * Only 500 errors: log stack.
 */
import logger from "../config/logger.js";

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code || "INTERNAL_ERROR";

  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message =
      err.errors && typeof err.errors === "object"
        ? Object.values(err.errors)
          .map((e) => e.message)
          .join(". ")
        : err.message;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "AUTH_INVALID";
    message = "Invalid token.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "AUTH_EXPIRED";
    message = "Token expired.";
  } else if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_RESOURCE";
    message = "Duplicate field value. Resource already exists.";
  } else if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    code = "FILE_TOO_LARGE";
    message = "File size exceeds 5MB limit.";
  } else if (err.code === "UNSUPPORTED_MEDIA" || err.statusCode === 415) {
    statusCode = 415;
    code = "UNSUPPORTED_MEDIA";
    message = err.message || "Unsupported media type. Only PDF is allowed.";
  } else if (
    err.name === "EmbeddingGenerationError" ||
    err.name === "VectorStoreError" ||
    err.name === "LLMCompletionError" ||
    err.name === "SpeechError" ||
    err.name === "TTSError" ||
    err.name === "TranslationError"
  ) {
    message = err.message;
    code = err.code || "AI_SERVICE_ERROR";
    if (err.statusCode) statusCode = err.statusCode;
  } else if (err.code === "STT_FAILED") {
    message = err.message;
    code = "STT_FAILED";
    statusCode = err.statusCode || 500;
  } else if (err.message === "CORS not allowed") {
    statusCode = 403;
    code = "CORS_DENIED";
    message = "CORS not allowed";
  }

  const isValidationError = statusCode === 400 && code === "VALIDATION_ERROR";

  if (statusCode >= 500) {
    logger.error("Server error", {
      message: err.message,
      statusCode,
      code,
      path: req.path,
      stack: err.stack,
    });
  } else if (!isValidationError) {
    logger.warn("Client error", {
      message,
      statusCode,
      code,
      path: req.path,
    });
  }

  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  res.status(statusCode).json(response);
};

export default errorMiddleware;
