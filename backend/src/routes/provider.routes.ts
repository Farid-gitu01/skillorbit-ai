import { Router } from 'express';
import {
  getMyProviderProfile,
  getProviderDashboard,
  getProviderEngagementById,
  getProviderEngagements,
  updateProviderEngagement,
  upsertMyProviderProfile,
} from '../controllers/provider.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import {
  validateEngagementIdParam,
  validateProviderEngagementsQuery,
  validateUpdateEngagement,
  validateUpsertProviderOrganization,
} from '../validators/provider.validator.js';

const router = Router();

router.use(asyncHandler(protect), restrictTo('provider'));

router.get('/dashboard', asyncHandler(getProviderDashboard));
router.get('/profile', asyncHandler(getMyProviderProfile));
router.put('/profile', validateUpsertProviderOrganization, asyncHandler(upsertMyProviderProfile));
router.get(
  '/engagements',
  validateProviderEngagementsQuery,
  asyncHandler(getProviderEngagements)
);
router.get(
  '/engagements/:engagementId',
  validateEngagementIdParam,
  asyncHandler(getProviderEngagementById)
);
router.patch(
  '/engagements/:engagementId',
  validateUpdateEngagement,
  asyncHandler(updateProviderEngagement)
);

export default router;
