import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
	message: {
		success: false,
		message: 'Too many password reset attempts. Please try again later.',
	},
});

const emailVerificationLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	message: {
		success: false,
		message: 'Too many verification attempts. Please try again later.',
	},
});

router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, validatePasswordResetRequest, requestPasswordReset);
router.post('/reset-password', passwordResetLimiter, validatePasswordReset, resetPassword);
router.post('/verify-email', emailVerificationLimiter, validateEmailVerification, verifyEmail);
router.post('/resend-verification', emailVerificationLimiter, validateResendVerification, resendVerificationEmail);

export default router;
