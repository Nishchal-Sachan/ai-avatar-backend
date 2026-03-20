import express from "express";
import { textToSpeech } from "../services/tts.service.js";
import { protect } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

const router = express.Router();

router.post(
  "/text-to-speech",
  protect,
  asyncHandler(async (req, res, next) => {
    const { text } = req.body;
    if (!text?.trim()) {
      throw new AppError("Text is required", 400, "VALIDATION_ERROR");
    }
    const audioUrl = await textToSpeech(text);
    res.json({
      success: true,
      data: { audioUrl },
    });
  })
);

export default router;
