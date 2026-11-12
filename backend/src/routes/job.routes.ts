import { Router } from 'express';
import {
  getJobs,
  getJobById,
  getRecommendedJobs,
  saveJob,
  unsaveJob,
  getSavedJobs,
} from '../controllers/job.controller.js';
import {
  createJob,
  deleteJob,
  getEmployerJobs,
  searchSkills,
  updateJob,
  updateJobStatus,
} from '../controllers/employer-job.controller.js';
import { protect, optionalProtect, restrictTo } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { validateGetJobs } from '../validators/job.validator.js';
import {
  validateCreateJob,
  validateEmployerJobsQuery,
  validateIdParam,
  validateUpdateJob,
  validateUpdateJobStatus,
} from '../validators/employer.validator.js';

const router = Router();

router.get('/', asyncHandler(optionalProtect), validateGetJobs, asyncHandler(getJobs));
router.get('/skills', asyncHandler(protect), asyncHandler(searchSkills));
router.get(
  '/employer',
  asyncHandler(protect),
  restrictTo('employer'),
  validateEmployerJobsQuery,
  asyncHandler(getEmployerJobs)
);
router.get('/recommended', asyncHandler(protect), restrictTo('seeker'), asyncHandler(getRecommendedJobs));
router.get('/saved', asyncHandler(protect), restrictTo('seeker'), asyncHandler(getSavedJobs));
router.get('/:id', asyncHandler(optionalProtect), asyncHandler(getJobById));

router.post('/', asyncHandler(protect), restrictTo('employer'), validateCreateJob, asyncHandler(createJob));
router.put('/:id', asyncHandler(protect), restrictTo('employer'), validateUpdateJob, asyncHandler(updateJob));
router.patch(
  '/:id/status',
  asyncHandler(protect),
  restrictTo('employer'),
  validateUpdateJobStatus,
  asyncHandler(updateJobStatus)
);
router.delete('/:id', asyncHandler(protect), restrictTo('employer'), validateIdParam, asyncHandler(deleteJob));

router.post('/:id/save', asyncHandler(protect), restrictTo('seeker'), asyncHandler(saveJob));
router.delete('/:id/save', asyncHandler(protect), restrictTo('seeker'), asyncHandler(unsaveJob));

export default router;
