import { z } from 'zod';

const getUtf8ByteLength = (str: string): number => new TextEncoder().encode(str).length;

export const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((val) => getUtf8ByteLength(val) <= 72, {
    message: 'Password must not exceed 72 UTF-8 bytes',
  });

export const emailValidation = z
  .string()
  .trim()
  .toLowerCase()
  .email('A valid email address is required')
  .max(254, 'Email must not exceed 254 characters');

export const registerFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must not exceed 100 characters'),
    email: emailValidation,
    password: passwordValidation,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['seeker', 'employer', 'provider'], {
      message: 'Please select a valid role',
    }),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the Terms of Service and Privacy Policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerFormSchema>;

export const loginFormSchema = z.object({
  email: emailValidation,
  password: z
    .string()
    .min(1, 'Password is required')
    .refine((val) => getUtf8ByteLength(val) <= 72, {
      message: 'Password must not exceed 72 UTF-8 bytes',
    }),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const forgotPasswordFormSchema = z.object({
  email: emailValidation,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;

export const resetPasswordFormSchema = z
  .object({
    token: z.string().regex(/^[a-f\d]{64}$/i, 'A valid 64-character reset token is required'),
    newPassword: passwordValidation,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;

export const resendVerificationFormSchema = z.object({
  email: emailValidation,
});

export type ResendVerificationFormData = z.infer<typeof resendVerificationFormSchema>;
