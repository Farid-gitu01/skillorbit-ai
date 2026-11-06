/**
 * env.ts — Environment variable validation
 *
 * Runs at application startup (before any other module).
 * Reads from process.env (populated by dotenv in server.ts).
 * Fails fast with a clear message when a required variable is absent.
 *
 * AI_PROVIDER and AI_API_KEY are optional at startup — they are only
 * required when the AI service layer is activated.  The validation
 * below warns when they are absent but does NOT crash the server.
 */

type NodeEnv = 'development' | 'production' | 'test';

interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CLIENT_URL: string;
  AI_PROVIDER: string | undefined;
  AI_API_KEY: string | undefined;
}

function assertRequired(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    console.error(`[env] FATAL: Required environment variable "${name}" is missing or empty.`);
    process.exit(1);
  }
  return value;
}

function parsePort(raw: string | undefined): number {
  const port = parseInt(raw ?? '5000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`[env] FATAL: PORT must be a valid number between 1 and 65535. Got: "${raw}"`);
    process.exit(1);
  }
  return port;
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const valid: NodeEnv[] = ['development', 'production', 'test'];
  const value = (raw ?? 'development') as NodeEnv;
  if (!valid.includes(value)) {
    console.warn(`[env] WARNING: Unknown NODE_ENV "${raw}". Defaulting to "development".`);
    return 'development';
  }
  return value;
}

export const env: Env = {
  NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
  PORT: parsePort(process.env.PORT),
  MONGODB_URI: assertRequired('MONGODB_URI', process.env.MONGODB_URI),
  JWT_SECRET: assertRequired('JWT_SECRET', process.env.JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  AI_PROVIDER: process.env.AI_PROVIDER || undefined,
  AI_API_KEY: process.env.AI_API_KEY || undefined,
};

// Warn (not crash) when AI config is absent — it is optional until the AI service is activated
if (!env.AI_PROVIDER || !env.AI_API_KEY) {
  console.warn('[env] AI_PROVIDER and/or AI_API_KEY are not set. AI features will be unavailable.');
}
