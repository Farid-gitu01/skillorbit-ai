/**
 * constants.ts — Application-wide constants derived from validated environment.
 *
 * Import from here rather than reading process.env directly in route/controller files.
 * All values are validated and typed by env.ts.
 */
import { env } from './env.js';

export const PORT = env.PORT;
export const NODE_ENV = env.NODE_ENV;
export const MONGODB_URI = env.MONGODB_URI;
export const JWT_SECRET = env.JWT_SECRET;
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
export const JWT_EXPIRES_IN_SECONDS = env.JWT_EXPIRES_IN_SECONDS;
export const CLIENT_URL = env.CLIENT_URL;
export const SMTP_HOST = env.SMTP_HOST;
export const SMTP_PORT = env.SMTP_PORT;
export const SMTP_SECURE = env.SMTP_SECURE;
export const SMTP_USER = env.SMTP_USER;
export const SMTP_PASS = env.SMTP_PASS;
export const EMAIL_FROM = env.EMAIL_FROM;
export const IS_PRODUCTION = env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = env.NODE_ENV === 'development';
export const IS_EXPLICIT_DEVELOPMENT = process.env.NODE_ENV === 'development';

// AI — optional until configured; credentials remain backend-only
export const AI_PROVIDER = env.AI_PROVIDER;
export const AI_API_KEY = env.AI_API_KEY;
export const AI_MODEL = env.AI_MODEL;
export const AI_BASE_URL = env.AI_BASE_URL;
export const AI_TIMEOUT_MS = env.AI_TIMEOUT_MS;
export const AI_MAX_RETRIES = env.AI_MAX_RETRIES;
