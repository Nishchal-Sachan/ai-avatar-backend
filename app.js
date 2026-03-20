import express from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { corsMiddleware } from "./middleware/cors.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { responseTime } from "./middleware/responseTime.js";
import routes from "./routes/index.js";
import AppError from "./utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1); // required for Render / reverse proxies

app.use(helmet());
app.use(corsMiddleware);
app.use(requestId);
app.use(responseTime);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    status: "API running",
    service: "AI Avatar Backend",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", apiLimiter, routes);

app.use((req, res, next) => {
  next(new AppError(`Not found - ${req.originalUrl}`, 404, "NOT_FOUND"));
});

app.use(errorMiddleware);

export default app;
