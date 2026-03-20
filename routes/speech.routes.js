import express from "express";
import multer from "multer";
import { uploadAudio } from "../middleware/upload.js";
import { speechToText } from "../services/speech.service.js";
import { protect } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

const router = express.Router();

const handleUpload = (req, res, next) => {
  uploadAudio.single("audio")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("Audio file exceeds 10MB limit.", 400, "FILE_TOO_LARGE"));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new AppError(`Unexpected field: ${err.field}`, 400, "VALIDATION_ERROR"));
        }
      }
      return next(err);
    }
    next();
  });
};

router.post(
  "/speech-to-text",
  protect,
  handleUpload,
  asyncHandler(async (req, res) => {
    if (!req.file?.path) {
      throw new AppError("No audio file provided", 400, "VALIDATION_ERROR");
    }
    const text = await speechToText(req.file.path);
    res.json({
      success: true,
      data: { text },
    });
  })
);

export default router;
