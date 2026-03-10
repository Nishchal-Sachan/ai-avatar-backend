import './config/env.js';
import app from './app.js';
import connectDB, { disconnectDB } from './config/db.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 3000;

let server = null;

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, stack: reason?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

const startServer = async () => {
  await connectDB();
  server = app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env (e.g. PORT=3001)`);
    } else {
      logger.error('Server error', { error: err.message });
    }
    process.exit(1);
  });
};

const SHUTDOWN_TIMEOUT_MS = 10000;

const shutdown = async (signal) => {
  logger.info('Shutdown signal received', { signal });

  const forceExit = () => {
    logger.warn('Forcing exit after timeout');
    process.exit(1);
  };
  const timeout = setTimeout(forceExit, SHUTDOWN_TIMEOUT_MS);

  if (server) {
    server.close(() => {
      clearTimeout(timeout);
      logger.info('HTTP server closed');
      disconnectDB().then(() => process.exit(0)).catch(() => process.exit(1));
    });
  } else {
    clearTimeout(timeout);
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
