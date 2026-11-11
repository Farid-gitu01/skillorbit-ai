import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import { sendError } from '../utils/api-response.util.js';

const router = Router();

// ── Auth rate limiter (applied only to /api/auth) ───────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'Too many authentication attempts. Please try again later.', {
      code: 'AUTH_RATE_LIMITED',
    });
  },
  skipSuccessfulRequests: true,
});

// ── Route registrations ──────────────────────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);

export default router;
