import { Router } from 'express';
import {
  applyForJob,
  getMyApplications,
  getApplicationById,
  withdrawApplication,
} from '../controllers/application.controller.js';
import {
  getEmployerApplications,
  updateApplicationNote,
  updateApplicationStatus,
} from '../controllers/employer-application.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { validateApplyJob } from '../validators/application.validator.js';
import {
  validateEmployerApplicationsQuery,
  validateUpdateApplicationNote,
  validateUpdateApplicationStatus,
} from '../validators/employer.validator.js';

const router = Router();

router.get('/me', asyncHandler(protect), restrictTo('seeker'), asyncHandler(getMyApplications));
router.get(
  '/employer',
  asyncHandler(protect),
  restrictTo('employer'),
  validateEmployerApplicationsQuery,
  asyncHandler(getEmployerApplications)
);
router.post('/', asyncHandler(protect), restrictTo('seeker'), validateApplyJob, asyncHandler(applyForJob));
router.get('/:id', asyncHandler(protect), asyncHandler(getApplicationById));
router.patch(
  '/:id/status',
  asyncHandler(protect),
  restrictTo('employer'),
  validateUpdateApplicationStatus,
  asyncHandler(updateApplicationStatus)
);
router.patch(
  '/:id/note',
  asyncHandler(protect),
  restrictTo('employer'),
  validateUpdateApplicationNote,
  asyncHandler(updateApplicationNote)
);
router.post('/:id/withdraw', asyncHandler(protect), restrictTo('seeker'), asyncHandler(withdrawApplication));

export default router;
