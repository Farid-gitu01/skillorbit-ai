/**
 * rate-limit.middleware.ts — Centralized API Rate Limiting Configuration
 *
 * Implements tiered, standards-compliant rate limiting across the application
 * using express-rate-limit. All handlers emit standardized API error envelopes
 * and standard RateLimit-* headers (RFC draft).
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { sendError } from '../utils/api-response.util.js';

interface CreateLimiterOptions {
  windowMs: number;
  max: number;
  code: string;
  message: string;
  skipSuccessfulRequests?: boolean;
}

export const createApiLimiter = (options: CreateLimiterOptions): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    handler: (_req, res) => {
      sendError(res, 429, options.message, { code: options.code });
    },
  });
};

/**
 * Global rate limiter: 100 requests per 1-minute window per IP.
 * Protects platform infrastructure against high-volume scraping and denial of service.
 */
export const globalLimiter = createApiLimiter({
  windowMs: 60 * 1000,
  max: 100,
  code: 'RATE_LIMITED',
  message: 'Too many requests, please try again later.',
});

/**
 * Authentication group rate limiter: 20 failed attempts per 15 minutes per IP across /api/auth.
 * Skips counting successful requests so legitimate active users are not penalized.
 */
export const authLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  code: 'AUTH_RATE_LIMITED',
  message: 'Too many authentication attempts. Please try again later.',
});

/**
 * Dedicated login rate limiter: 10 attempts per 15 minutes per IP.
 * Prevents automated password guessing and credential stuffing attacks on /api/auth/login.
 */
export const loginLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  code: 'LOGIN_RATE_LIMITED',
  message: 'Too many login attempts. Please try again later.',
});

/**
 * Dedicated registration rate limiter: 10 account creations per 15 minutes per IP.
 * Counts all attempts (skipSuccessfulRequests: false) to prevent spam registration bots.
 */
export const registerLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  code: 'REGISTER_RATE_LIMITED',
  message: 'Too many registration requests from this IP. Please try again later.',
});

/**
 * Password reset rate limiter: 5 attempts per 15 minutes per IP.
 * Protects /forgot-password and /reset-password from email bombing and token brute-forcing.
 */
export const passwordResetLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  code: 'PASSWORD_RESET_RATE_LIMITED',
  message: 'Too many password reset attempts. Please try again later.',
});

/**
 * Email verification rate limiter: 5 attempts per 15 minutes per IP.
 * Protects /verify-email and /resend-verification against token enumeration and mail flooding.
 */
export const emailVerificationLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  code: 'VERIFICATION_RATE_LIMITED',
  message: 'Too many verification attempts. Please try again later.',
});
