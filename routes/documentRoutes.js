import { Router } from "express";
import * as documentController from "../controllers/documentController.js";
import { protect, authorizeUserType } from "../middleware/auth.middleware.js";
import { uploadSingle } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { documentUploadSchema, documentIdParamSchema } from "../middleware/schemas.js";

const router = Router();

/**
 * POST /documents
 * Creator only. PDF only, max 5MB.
 * Multipart: file (required), title (required), avatarId (optional)
 */
router.post(
  "/",
  protect,
  authorizeUserType("creator"),
  uploadSingle("file"),
  validate(documentUploadSchema),
  documentController.upload
);

/**
 * DELETE /documents/:id
 * Creator only. Only the uploader can delete.
 */
router.delete(
  "/:id",
  protect,
  authorizeUserType("creator"),
  validate(documentIdParamSchema),
  documentController.remove
);

export default router;
