import { Router } from 'express';
import { getProfile } from '../controllers/user.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.get('/me', asyncHandler(protect), asyncHandler(getProfile));

export default router;
