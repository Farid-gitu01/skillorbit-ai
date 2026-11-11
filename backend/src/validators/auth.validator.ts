import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

export const passwordSchema = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
		message: 'Password must not exceed 72 UTF-8 bytes',
	});

const emailSchema = z.string().trim().toLowerCase().email('A valid email address is required').max(254);

export const registerSchema = z
	.object({
		fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
		email: emailSchema,
		password: passwordSchema,
		role: z.enum(['seeker', 'employer', 'provider']),
	})
	.strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
	.object({
		email: emailSchema,
		password: z
			.string()
			.min(1, 'Password is required')
			.refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
				message: 'Password must not exceed 72 UTF-8 bytes',
			}),
	})
	.strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({ email: emailSchema }).strict();
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z
	.object({
		token: z.string().regex(/^[a-f\d]{64}$/i, 'A valid reset token is required'),
		newPassword: passwordSchema,
	})
	.strict();
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const emailVerificationSchema = z
	.object({ token: z.string().regex(/^[a-f\d]{64}$/i, 'A valid verification token is required') })
	.strict();
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;

export const resendVerificationSchema = z.object({ email: emailSchema }).strict();
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const validateRegistration = validateRequest(
	{ body: registerSchema },
	'Registration validation failed'
);

export const validateLogin = validateRequest({ body: loginSchema }, 'Login validation failed');

export const validatePasswordResetRequest = validateRequest(
	{ body: passwordResetRequestSchema },
	'Password reset request validation failed'
);

export const validatePasswordReset = validateRequest(
	{ body: passwordResetSchema },
	'Password reset validation failed'
);

export const validateEmailVerification = validateRequest(
	{ body: emailVerificationSchema },
	'Email verification validation failed'
);

export const validateResendVerification = validateRequest(
	{ body: resendVerificationSchema },
	'Verification request validation failed'
);
