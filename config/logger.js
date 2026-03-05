/**
 * Winston logger - structured logs for production.
 */
import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    isProd ? json() : combine(colorize(), simple())
  ),
  defaultMeta: { service: 'api' },
  transports: [new winston.transports.Console()],
});

export default logger;
