import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

// ── Auth rate limiter (applied only to /api/auth) ───────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
  skipSuccessfulRequests: true,
});

// ── Route registrations ──────────────────────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);

export default router;
