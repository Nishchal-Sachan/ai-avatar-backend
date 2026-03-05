/**
 * Strict CORS configuration - allows only Unity frontend domain.
 * Configure via CORS_ORIGIN env (e.g. https://your-unity-app.com).
 * In development, localhost is allowed when CORS_ORIGIN is not set.
 */
import cors from 'cors';

const allowedOrigin = process.env.CORS_ORIGIN?.trim();
const isDev = process.env.NODE_ENV !== 'production';

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigin && origin === allowedOrigin) return callback(null, true);
    if (!allowedOrigin && isDev) return callback(null, true);
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
};

export const corsMiddleware = cors(corsOptions);
