import { Router } from 'express';
import {
  getMyResumes,
  uploadResume,
  downloadResume,
  deleteResume,
  setPrimaryResume,
} from '../controllers/resume.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { resumeUpload } from '../middlewares/upload.middleware.js';

const router = Router();

router.get('/me', asyncHandler(protect), restrictTo('seeker'), asyncHandler(getMyResumes));
router.post(
  '/upload',
  asyncHandler(protect),
  restrictTo('seeker'),
  resumeUpload.single('resume'),
  asyncHandler(uploadResume)
);
router.get('/:id/download', asyncHandler(protect), asyncHandler(downloadResume));
router.delete('/:id', asyncHandler(protect), restrictTo('seeker'), asyncHandler(deleteResume));
router.patch('/:id/primary', asyncHandler(protect), restrictTo('seeker'), asyncHandler(setPrimaryResume));

export default router;
