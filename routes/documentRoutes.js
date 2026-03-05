import { Router } from 'express';
import * as documentController from '../controllers/documentController.js';
import { protect, authorizeUserType } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

/**
 * POST /documents/upload
 * Creator only. Only creators can upload knowledge documents.
 * Requires protect + authorizeUserType("creator").
 */
router.post(
  '/upload',
  protect,
  authorizeUserType('creator'),
  uploadSingle('file'),
  documentController.upload
);
router.delete('/:id', protect, authorizeUserType('creator'), documentController.remove);

export default router;
