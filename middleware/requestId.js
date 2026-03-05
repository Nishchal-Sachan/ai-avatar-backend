/**
 * Request ID middleware - assigns unique ID for tracing.
 * Sets req.requestId and X-Request-Id response header.
 */
import crypto from 'crypto';

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
