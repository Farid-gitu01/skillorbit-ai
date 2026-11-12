import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import profileRoutes from './profile.routes.js';
import resumeRoutes from './resume.routes.js';
import jobRoutes from './job.routes.js';
import applicationRoutes from './application.routes.js';
import notificationRoutes from './notification.routes.js';
import seekerDashboardRoutes from './seeker-dashboard.routes.js';
import employerRoutes from './employer.routes.js';
import providerRoutes from './provider.routes.js';
import courseRoutes from './course.routes.js';
import adminRoutes from './admin.routes.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ── Auth rate limiter (max: 20 failed attempts per 15 min applied to /api/auth) ──
router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', profileRoutes);
router.use('/resumes', resumeRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/seeker/dashboard', seekerDashboardRoutes);
router.use('/employer', employerRoutes);
router.use('/provider', providerRoutes);
router.use('/courses', courseRoutes);
router.use('/admin', adminRoutes);

export default router;
