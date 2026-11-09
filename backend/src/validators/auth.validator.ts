import { type RequestHandler } from 'express';
import { z } from 'zod';

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

const validateSchema = <T>(schema: z.ZodType<T>, message: string): RequestHandler =>
	(req, res, next) => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			res.status(400).json({
				success: false,
				message,
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join('.'),
					message: issue.message,
				})),
			});
			return;
		}
		req.body = result.data;
		next();
	};

export const validateRegistration: RequestHandler = (req, res, next) => {
	const result = registerSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({
			success: false,
			message: 'Registration validation failed',
			errors: result.error.issues.map((issue) => ({
				field: issue.path.join('.'),
				message: issue.message,
			})),
		});
		return;
	}

	// Keep only schema-approved values and apply email/name normalization.
	req.body = result.data;
	next();
};

export const validateLogin: RequestHandler = (req, res, next) => {
	const result = loginSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({
			success: false,
			message: 'Login validation failed',
			errors: result.error.issues.map((issue) => ({
				field: issue.path.join('.'),
				message: issue.message,
			})),
		});
		return;
	}

	req.body = result.data;
	next();
};

export const validatePasswordResetRequest = validateSchema(
	passwordResetRequestSchema,
	'Password reset request validation failed'
);

export const validatePasswordReset = validateSchema(passwordResetSchema, 'Password reset validation failed');

export const validateEmailVerification = validateSchema(
	emailVerificationSchema,
	'Email verification validation failed'
);

export const validateResendVerification = validateSchema(
	resendVerificationSchema,
	'Verification request validation failed'
);
