import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { responseTime } from './middleware/responseTime.js';
import { requestId } from './middleware/requestId.js';
import { corsMiddleware } from './middleware/cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());
app.use(corsMiddleware);
app.use(requestId);
app.use(responseTime);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/v1', apiLimiter, routes);

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: { message: `Not found - ${req.originalUrl}` },
  });
});

app.use(errorHandler);

export default app;
