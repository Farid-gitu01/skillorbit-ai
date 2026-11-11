import { Router } from 'express';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import {
	emailVerificationLimiter,
	loginLimiter,
	passwordResetLimiter,
	registerLimiter,
} from '../middlewares/rate-limit.middleware.js';
import {
	login,
	logout,
	register,
	requestPasswordReset,
	resetPassword,
	resendVerificationEmail,
	verifyEmail,
} from '../controllers/auth.controller.js';
import {
	validateLogin,
	validatePasswordReset,
	validatePasswordResetRequest,
	validateRegistration,
	validateEmailVerification,
	validateResendVerification,
} from '../validators/auth.validator.js';

const router = Router();

// Password reset limiter: max: 5 attempts / 15m, skipSuccessfulRequests: false
// Email verification limiter: max: 5 attempts / 15m, skipSuccessfulRequests: false

router.post('/register', registerLimiter, validateRegistration, asyncHandler(register));
router.post('/login', loginLimiter, validateLogin, asyncHandler(login));
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, validatePasswordResetRequest, asyncHandler(requestPasswordReset));
router.post('/reset-password', passwordResetLimiter, validatePasswordReset, asyncHandler(resetPassword));
router.post('/verify-email', emailVerificationLimiter, validateEmailVerification, asyncHandler(verifyEmail));
router.post('/resend-verification', emailVerificationLimiter, validateResendVerification, asyncHandler(resendVerificationEmail));

export default router;
