/**
 * Rate limiting middleware.
 * Returns 429 Too Many Requests when limit exceeded.
 */
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

const windowMs = 15 * 60 * 1000; // 15 minutes
const limit = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100;

export const apiLimiter = rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const requestId = req.requestId || req.headers['x-request-id'] || crypto.randomUUID();
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests. Try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        requestId,
      },
    });
  },
});
