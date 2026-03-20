/**
 * Custom application error with status code and error code support.
 * Used for consistent error handling across the application.
 *
 * Status code mapping:
 * 400 → validation (VALIDATION_ERROR)
 * 401 → auth (AUTH_REQUIRED, AUTH_INVALID, AUTH_EXPIRED)
 * 403 → forbidden (ACCESS_DENIED, CORS_DENIED)
 * 404 → not found (NOT_FOUND)
 * 500 → server error (INTERNAL_ERROR)
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
