import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import Document from '../models/Document.js';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { chunkText } from '../utils/chunkText.js';
import { storeChunk, deleteChunksByDocument } from './embedding/chunkStore.js';
import {
  generateEmbedding,
  storeEmbedding,
  deleteEmbeddingsByDocument,
} from './embeddingService.js';

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.info('Cleaned up failed upload', { filePath });
    } catch (unlinkErr) {
      logger.warn('Failed to cleanup file', { filePath, error: unlinkErr.message });
    }
  }
}

/**
 * Upload document: extract text, save metadata to MongoDB.
 * Deletes uploaded file if PDF parsing fails.
 * @param {Object} params - { file, title, avatarId?, userId }
 * @returns {Promise<Object>} { document, extractedTextLength }
 */
export const uploadDocument = async ({ file, title, avatarId, userId }) => {
  if (!file?.path) {
    throw new AppError('No file provided.', 400, 'VALIDATION_ERROR');
  }

  let extractedTextLength = 0;
  let text = '';

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    text = pdfData.text?.trim() || '';
    extractedTextLength = text.length;
    logger.info('Document text extracted', { extractedTextLength });
  } catch (err) {
    cleanupFile(file.path);
    throw new AppError(
      'Invalid document format. File may be corrupted or not a valid PDF.',
      400,
      'INVALID_DOCUMENT'
    );
  }

  const relativePath = `uploads/${path.basename(file.path)}`;
  const namespace = avatarId?.trim() || 'default';

  const document = await Document.create({
    title: title?.trim() || file.originalname || 'Untitled',
    filePath: relativePath,
    avatarId: avatarId?.trim() || undefined,
    uploadedBy: userId,
  });

  const documentId = document._id.toString();

  if (text) {
    const chunks = chunkText(text);
    console.log("Chunks stored in vector DB:", chunks.length);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${documentId}-${i}`;
      const metadata = { documentId, chunkIndex: i, avatarId: namespace };

      storeChunk(chunkId, chunk, metadata);

      const vector = await generateEmbedding(chunk);
      await storeEmbedding(chunkId, vector, {
        namespace,
        metadata: {
          text: chunk,
          avatarId: namespace,
          documentId,
          chunkIndex: i,
        },
      });
    }
  }

  return { document, extractedTextLength };
};

/**
 * Soft delete document by ID. Admin only. Does NOT delete file from disk.
 * @param {string} documentId
 */
export async function deleteDocument(documentId) {
  const document = await Document.findById(documentId);

  if (!document) {
    throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  }

  document.isDeleted = true;
  document.deletedAt = new Date();
  await document.save();

  try {
    const namespace = document.avatarId?.trim() || 'default';
    await deleteEmbeddingsByDocument(documentId, { namespace });
    deleteChunksByDocument(documentId);
  } catch (err) {
    logger.warn('Failed to delete document embeddings', { documentId, error: err.message });
  }

  return document;
}
