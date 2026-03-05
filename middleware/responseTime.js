/**
 * Response time tracking middleware
 * - Adds X-Response-Time header
 * - Logs request completion details
 */

import logger from '../config/logger.js';
import onHeaders from 'on-headers';

export function responseTime(req, res, next) {
  const start = performance.now();

  // Set header right before headers are sent
  onHeaders(res, function () {
    const ms = Math.round(performance.now() - start);
    res.setHeader('X-Response-Time', `${ms}ms`);
  });

  // Log after response finishes
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);

    const meta = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTimeMs: ms,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with error', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', meta);
    } else {
      logger.info('Request completed', meta);
    }
  });

  next();
}