import { Router } from 'express';
import { getSeekerDashboard } from '../controllers/seeker-dashboard.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.get('/', asyncHandler(protect), restrictTo('seeker'), asyncHandler(getSeekerDashboard));

export default router;
