import { Router } from 'express';
import * as audioController from '../controllers/audioController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/synthesize/stream', protect, audioController.streamSynthesize);

export default router;
