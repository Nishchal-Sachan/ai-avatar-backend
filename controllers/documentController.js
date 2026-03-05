import * as documentService from '../services/documentService.js';
import * as avatarService from '../services/avatarService.js';

/**
 * Upload a PDF document.
 * POST /api/v1/documents
 * Requires: multipart/form-data with 'file' and 'title'
 * Only avatar creator or admin can upload.
 */
export const upload = async (req, res, next) => {
  try {
    const { title, avatarId } = req.body;
    await avatarService.validateDocumentUploadAccess(avatarId, req.user);

    const { document, extractedTextLength } = await documentService.uploadDocument({
      file: req.file,
      title,
      avatarId,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: {
        document,
        extractedTextLength,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete document. Admin only.
 * DELETE /api/v1/documents/:id
 */
export const remove = async (req, res, next) => {
  try {
    await documentService.deleteDocument(req.params.id);
    res.status(200).json({
      success: true,
      data: { message: 'Document deleted' },
    });
  } catch (error) {
    next(error);
  }
};
