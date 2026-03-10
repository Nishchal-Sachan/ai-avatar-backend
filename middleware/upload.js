import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AppError } from '../utils/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = 'application/pdf';
const ALLOWED_EXTENSIONS = ['.pdf'];

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
    return cb(new AppError('Only PDF files are allowed.', 415, 'UNSUPPORTED_MEDIA'), false);
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new AppError('Invalid file extension. Only .pdf is allowed.', 415, 'UNSUPPORTED_MEDIA'), false);
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
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('File size exceeds 5MB limit.', 400, 'FILE_TOO_LARGE'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError(`Unexpected field: ${err.field}.`, 400, "VALIDATION_ERROR"));
        }
      }
      return next(err);
    }
    if (!req.file) {
      return next(new AppError('No file provided. Please upload a PDF file.', 400, "VALIDATION_ERROR"));
    }
    next();
  });
};

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a'];
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a'];

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const audioDir = path.join(UPLOAD_DIR, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)?.toLowerCase() || '.mp3';
    const safeExt = AUDIO_EXTENSIONS.includes(ext) ? ext : '.mp3';
    cb(null, `audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const audioFileFilter = (req, file, cb) => {
  if (!AUDIO_MIME_TYPES.includes(file.mimetype)) {
    return cb(new AppError('Invalid audio format. Only WAV, MP3, and M4A are allowed.', 400), false);
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!AUDIO_EXTENSIONS.includes(ext)) {
    return cb(new AppError('Invalid file extension. Only .wav, .mp3, .m4a are allowed.', 400), false);
  }
  cb(null, true);
};

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
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Audio file exceeds 25MB limit.', 400));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError(`Unexpected field: ${err.field}.`, 400, "VALIDATION_ERROR"));
        }
      }
      return next(err);
    }
    next();
  });
};
