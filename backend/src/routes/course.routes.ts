import { Router } from 'express';
import {
  createCourse,
  deleteCourse,
  enrollInCourse,
  getCourseById,
  getCourseLearners,
  getProviderCourses,
  getPublicCourses,
  updateCourse,
  updateCourseStatus,
} from '../controllers/provider-course.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { optionalProtect, protect, restrictTo } from '../middlewares/auth.middleware.js';
import {
  validateCourseIdParam,
  validateCreateCourse,
  validateEnrollCourse,
  validateProviderCoursesQuery,
  validateProviderEngagementsQuery,
  validatePublicCoursesQuery,
  validateUpdateCourse,
  validateUpdateCourseStatus,
} from '../validators/provider.validator.js';

const router = Router();

router.get('/', asyncHandler(optionalProtect), validatePublicCoursesQuery, asyncHandler(getPublicCourses));
router.get(
  '/provider',
  asyncHandler(protect),
  restrictTo('provider'),
  validateProviderCoursesQuery,
  asyncHandler(getProviderCourses)
);
router.get(
  '/:id/learners',
  asyncHandler(protect),
  restrictTo('provider'),
  validateCourseIdParam,
  validateProviderEngagementsQuery,
  asyncHandler(getCourseLearners)
);
router.get('/:id', asyncHandler(optionalProtect), validateCourseIdParam, asyncHandler(getCourseById));

router.post('/', asyncHandler(protect), restrictTo('provider'), validateCreateCourse, asyncHandler(createCourse));
router.put('/:id', asyncHandler(protect), restrictTo('provider'), validateUpdateCourse, asyncHandler(updateCourse));
router.patch(
  '/:id/status',
  asyncHandler(protect),
  restrictTo('provider'),
  validateUpdateCourseStatus,
  asyncHandler(updateCourseStatus)
);
router.delete('/:id', asyncHandler(protect), restrictTo('provider'), validateCourseIdParam, asyncHandler(deleteCourse));

router.post(
  '/:id/enroll',
  asyncHandler(protect),
  restrictTo('seeker'),
  validateEnrollCourse,
  asyncHandler(enrollInCourse)
);

export default router;
