// /**
//  * CORS middleware.
//  * Production: allows configured CORS_ORIGIN.
//  * Development: allows localhost.
//  * Always allows requests with no origin (Postman, curl, server-to-server).
//  */
// import cors from "cors";
// import { AppError } from "../utils/AppError.js";

// const allowedOrigin = "*" || process.env.CORS_ORIGIN;

// export const corsMiddleware = cors({
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);

//     if (allowedOrigin && origin === allowedOrigin) {
//       return callback(null, true);
//     }

//     if (process.env.NODE_ENV !== "production") {
//       if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
//         return callback(null, true);
//       }
//     }

//     return callback(new AppError("CORS not allowed", 403, "CORS_DENIED"), false);
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// });

import cors from "cors";

export const corsMiddleware = cors({
  origin: "*", // allow all origins
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
