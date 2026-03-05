/**
 * API documentation route - returns JSON describing all endpoints.
 */
import { Router } from 'express';

const router = Router();

const docs = {
  version: '1.0',
  basePath: '/api/v1',
  endpoints: [
    {
      path: '/health',
      method: 'GET',
      auth: false,
      description: 'Health check',
      response: { status: 'ok', uptime: 'number', timestamp: 'ISO string' },
    },
    {
      path: '/docs',
      method: 'GET',
      auth: false,
      description: 'API documentation (this endpoint)',
      response: 'JSON object with all endpoints',
    },
    {
      path: '/auth/register',
      method: 'POST',
      auth: false,
      description: 'Register new user',
      body: { name: 'string', email: 'string', password: 'string', role: 'admin|user (optional)' },
    },
    {
      path: '/auth/login',
      method: 'POST',
      auth: false,
      description: 'Login and get JWT',
      body: { email: 'string', password: 'string' },
      response: { token: 'string', user: 'object' },
    },
    {
      path: '/auth/me',
      method: 'GET',
      auth: true,
      description: 'Get current user profile',
    },
    {
      path: '/documents',
      method: 'POST',
      auth: true,
      description: 'Upload PDF document',
      body: 'multipart/form-data with file field',
    },
    {
      path: '/documents/:id',
      method: 'DELETE',
      auth: true,
      roles: ['admin'],
      description: 'Delete document by ID',
    },
    {
      path: '/ask',
      method: 'POST',
      auth: true,
      description: 'Ask question (text or audio). Returns RAG answer with optional TTS.',
      body: {
        text: 'string (optional)',
        audio: 'file (optional, multipart)',
        avatarId: 'string (optional)',
        temperature: 'number (optional)',
        maxTokens: 'number (optional)',
        topK: 'number (optional)',
        streamAudio: 'boolean (optional)',
      },
      response: {
        metadata: 'requestId, executionTime, tokenUsage, chunkCount, timing',
        data: 'textResponse, audioUrl, detectedLanguage, responseLanguage, emotion, question',
      },
    },
    {
      path: '/avatars',
      method: 'POST',
      auth: true,
      roles: ['admin'],
      description: 'Create avatar',
      body: { name: 'string (optional)' },
    },
    {
      path: '/audio/synthesize/stream',
      method: 'POST',
      auth: true,
      description: 'Stream TTS audio from text',
      body: { text: 'string' },
      response: 'Streamed MP3 (audio/mpeg)',
    },
  ],
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: docs,
  });
});

export default router;
