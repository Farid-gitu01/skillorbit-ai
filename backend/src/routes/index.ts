import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ── Auth rate limiter (max: 20 failed attempts per 15 min applied to /api/auth) ──
router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);

export default router;
