import { Router } from 'express';
import authRoutes from './authRoutes.js';
import documentRoutes from './documentRoutes.js';
import askRoutes from './askRoutes.js';
import avatarRoutes from './avatarRoutes.js';
import audioRoutes from './audioRoutes.js';
import docsRoutes from './docsRoutes.js';

const router = Router();

router.use('/docs', docsRoutes);
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/ask', askRoutes);
router.use('/avatars', avatarRoutes);
router.use('/audio', audioRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
