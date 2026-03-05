/**
 * Rate limiting middleware.
 */
import { rateLimit } from 'express-rate-limit';

const windowMs = 15 * 60 * 1000; // 15 minutes
const limit = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100;

export const apiLimiter = rateLimit({
  windowMs,
  limit,
  message: { success: false, error: { message: 'Too many requests. Try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
