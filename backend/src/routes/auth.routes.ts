import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/api-response.util.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
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

const passwordResetLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	handler: (_req, res) => {
		sendError(res, 429, 'Too many password reset attempts. Please try again later.', {
			code: 'PASSWORD_RESET_RATE_LIMITED',
		});
	},
});

const emailVerificationLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	handler: (_req, res) => {
		sendError(res, 429, 'Too many verification attempts. Please try again later.', {
			code: 'VERIFICATION_RATE_LIMITED',
		});
	},
});

router.post('/register', validateRegistration, asyncHandler(register));
router.post('/login', validateLogin, asyncHandler(login));
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, validatePasswordResetRequest, asyncHandler(requestPasswordReset));
router.post('/reset-password', passwordResetLimiter, validatePasswordReset, asyncHandler(resetPassword));
router.post('/verify-email', emailVerificationLimiter, validateEmailVerification, asyncHandler(verifyEmail));
router.post('/resend-verification', emailVerificationLimiter, validateResendVerification, asyncHandler(resendVerificationEmail));

export default router;
