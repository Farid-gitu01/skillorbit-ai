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
export const CLIENT_URL = env.CLIENT_URL;
export const IS_PRODUCTION = env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = env.NODE_ENV === 'development';

// AI — intentionally undefined until an AI provider is configured
export const AI_PROVIDER = env.AI_PROVIDER;
export const AI_API_KEY = env.AI_API_KEY;
