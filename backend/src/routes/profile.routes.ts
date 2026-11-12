import { Router } from 'express';
import { getMyProfile, updateMyProfile, getPublicProfile } from '../controllers/profile.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { validateUpdateProfile } from '../validators/profile.validator.js';

const router = Router();

router.get('/me', asyncHandler(protect), asyncHandler(getMyProfile));
router.put('/me', asyncHandler(protect), validateUpdateProfile, asyncHandler(updateMyProfile));
router.get('/:id', asyncHandler(protect), asyncHandler(getPublicProfile));

export default router;
