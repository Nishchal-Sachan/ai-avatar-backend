/**
 * CORS middleware - allow all origins for now.
 */
import cors from "cors";

export const corsMiddleware = cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  credentials: false,
});
