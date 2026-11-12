import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.get('/', asyncHandler(protect), asyncHandler(getMyNotifications));
router.patch('/read-all', asyncHandler(protect), asyncHandler(markAllAsRead));
router.patch('/:id/read', asyncHandler(protect), asyncHandler(markAsRead));

export default router;
