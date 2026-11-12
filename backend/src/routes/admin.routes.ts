import { Router } from 'express';
import {
  getAdminAiHealth,
  getAdminDashboard,
  getAdminEmployerById,
  getAdminProviderById,
  getAdminUserById,
  listAdminEmployers,
  listAdminProviders,
  listAdminUsers,
  updateAdminUserStatus,
} from '../controllers/admin.controller.js';
import {
  getAdminCourseById,
  getAdminJobById,
  listAdminAuditLogs,
  listAdminCourses,
  listAdminJobs,
  listAdminVerifications,
  moderateAdminCourse,
  moderateAdminJob,
  reviewAdminVerification,
} from '../controllers/admin-moderation.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import {
  validateAdminAiHealthQuery,
  validateAdminAuditLogsQuery,
  validateAdminCoursesQuery,
  validateAdminIdParam,
  validateAdminJobsQuery,
  validateAdminPartnersQuery,
  validateAdminUsersQuery,
  validateAdminVerificationsQuery,
  validateModerateCourse,
  validateModerateJob,
  validateReviewVerification,
  validateUpdateUserStatus,
} from '../validators/admin.validator.js';

const router = Router();

// Every Admin endpoint enforces authenticated active Admin role from DB
router.use(asyncHandler(protect), restrictTo('admin'));

// Dashboard & Statistics
router.get('/dashboard', asyncHandler(getAdminDashboard));
router.get('/stats', asyncHandler(getAdminDashboard));
router.get('/ai/health', validateAdminAiHealthQuery, asyncHandler(getAdminAiHealth));

// User Management
router.get('/users', validateAdminUsersQuery, asyncHandler(listAdminUsers));
router.get('/users/:id', validateAdminIdParam, asyncHandler(getAdminUserById));
router.patch('/users/:id/status', validateUpdateUserStatus, asyncHandler(updateAdminUserStatus));

// Employer Management
router.get('/employers', validateAdminPartnersQuery, asyncHandler(listAdminEmployers));
router.get('/employers/:id', validateAdminIdParam, asyncHandler(getAdminEmployerById));

// Provider Management
router.get('/providers', validateAdminPartnersQuery, asyncHandler(listAdminProviders));
router.get('/providers/:id', validateAdminIdParam, asyncHandler(getAdminProviderById));

// Organization Verification Queue
router.get('/verifications', validateAdminVerificationsQuery, asyncHandler(listAdminVerifications));
router.patch(
  '/verifications/:orgId',
  validateReviewVerification,
  asyncHandler(reviewAdminVerification)
);

// Job & Course Platform Content Moderation
router.get('/jobs', validateAdminJobsQuery, asyncHandler(listAdminJobs));
router.get('/jobs/:id', validateAdminIdParam, asyncHandler(getAdminJobById));
router.patch('/jobs/:id/moderate', validateModerateJob, asyncHandler(moderateAdminJob));

router.get('/courses', validateAdminCoursesQuery, asyncHandler(listAdminCourses));
router.get('/courses/:id', validateAdminIdParam, asyncHandler(getAdminCourseById));
router.patch('/courses/:id/moderate', validateModerateCourse, asyncHandler(moderateAdminCourse));

// Append-only Immutable Audit Trail (read-only)
router.get('/audit-logs', validateAdminAuditLogsQuery, asyncHandler(listAdminAuditLogs));

export default router;
