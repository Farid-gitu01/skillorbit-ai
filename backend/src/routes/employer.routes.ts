import { Router } from 'express';
import {
  getEmployerCandidateById,
  getEmployerCandidates,
  getEmployerDashboard,
  getMyOrganization,
  upsertMyOrganization,
} from '../controllers/employer.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import {
  validateCandidateIdParam,
  validateEmployerCandidatesQuery,
  validateUpsertOrganization,
} from '../validators/employer.validator.js';

const router = Router();

router.use(asyncHandler(protect), restrictTo('employer'));

router.get('/dashboard', asyncHandler(getEmployerDashboard));
router.get('/organization', asyncHandler(getMyOrganization));
router.put('/organization', validateUpsertOrganization, asyncHandler(upsertMyOrganization));
router.get('/candidates', validateEmployerCandidatesQuery, asyncHandler(getEmployerCandidates));
router.get(
  '/candidates/:candidateId',
  validateCandidateIdParam,
  asyncHandler(getEmployerCandidateById)
);

export default router;
