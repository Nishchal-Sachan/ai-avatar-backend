import { Router } from 'express';
import * as askController from '../controllers/askController.js';
import { protect } from '../middleware/auth.js';
import { uploadAudioOptional } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { askSchema } from '../middleware/schemas.js';

const router = Router();

/**
 * POST /ask
 * Both creators and viewers can interact with avatars. Requires protect only.
 */
router.post(
  '/',
  protect,
  uploadAudioOptional('audio'),
  validate(askSchema),
  askController.ask
);

export default router;
