import * as documentService from "../services/documentService.js";
import * as avatarService from "../services/avatarService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

/**
 * Upload a PDF document.
 * POST /api/v1/documents
 * Requires: multipart/form-data with 'file' and 'title'
 * PDF only, max 5MB. Creator only.
 */
export const upload = asyncHandler(async (req, res) => {
  const { title, avatarId } = req.body;

  if (!title?.trim()) {
    throw new AppError("Title is required", 400, "VALIDATION_ERROR");
  }

  if (!req.file) {
    throw new AppError("No file provided. Please upload a PDF file.", 400, "VALIDATION_ERROR");
  }

  await avatarService.validateDocumentUploadAccess(avatarId, req.user);

  const { document, extractedTextLength } = await documentService.uploadDocument({
    file: req.file,
    title: title.trim(),
    avatarId: avatarId?.trim() || null,
    userId: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: {
      document,
      extractedTextLength,
    },
  });
});

/**
 * Delete document. Creator only.
 * DELETE /api/v1/documents/:id
 */
export const remove = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: { message: "Document deleted" },
  });
});
