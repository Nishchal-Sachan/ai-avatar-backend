import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = "application/pdf";
const ALLOWED_EXTENSIONS = [".pdf"];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== ALLOWED_MIME) {
    return cb(
      new AppError("Only PDF files are allowed.", 415, "UNSUPPORTED_MEDIA"),
      false,
    );
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new AppError(
        "Invalid file extension. Only .pdf is allowed.",
        415,
        "UNSUPPORTED_MEDIA",
      ),
      false,
    );
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

/**
 * Wraps multer single upload to handle MulterError and pass to error middleware.
 * Validates that a file was provided.
 */
export const uploadSingle = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError("File size exceeds 5MB limit.", 400, "FILE_TOO_LARGE"),
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new AppError(
              `Unexpected field: ${err.field}.`,
              400,
              "VALIDATION_ERROR",
            ),
          );
        }
      }
      return next(err);
    }
    if (!req.file) {
      return next(
        new AppError(
          "No file provided. Please upload a PDF file.",
          400,
          "VALIDATION_ERROR",
        ),
      );
    }
    next();
  });
};

const AUDIO_DIR = path.join(UPLOAD_DIR, "audio");
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + (file.originalname || "audio"));
  },
});

const audioFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/x-wav",
    "audio/m4a",
    "audio/webm",
    "audio/ogg",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError("Invalid audio format. Only WAV, MP3, M4A allowed", 400),
      false,
    );
  }
};

export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/**
 * Optional audio upload - does not require file. Use for /ask with text or audio.
 */
export const uploadAudioOptional = (fieldName) => (req, res, next) => {
  audioUpload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("Audio file exceeds 25MB limit.", 400));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new AppError(
              `Unexpected field: ${err.field}.`,
              400,
              "VALIDATION_ERROR",
            ),
          );
        }
      }
      return next(err);
    }
    next();
  });
};

/**
 * Required audio upload for STT. Use for /speech-to-text.
 */
export const uploadAudioRequired = (fieldName) => (req, res, next) => {
  audioUpload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(
              "Audio file exceeds 25MB limit.",
              400,
              "FILE_TOO_LARGE",
            ),
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new AppError(
              `Unexpected field: ${err.field}.`,
              400,
              "VALIDATION_ERROR",
            ),
          );
        }
      }
      return next(err);
    }
    if (!req.file) {
      return next(
        new AppError(
          "No audio file provided. Upload WAV, MP3, or M4A.",
          400,
          "VALIDATION_ERROR",
        ),
      );
    }
    next();
  });
};
