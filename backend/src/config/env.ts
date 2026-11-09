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
  JWT_EXPIRES_IN_SECONDS: number;
  CLIENT_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
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

function assertJwtSecret(value: string | undefined): string {
  const secret = assertRequired('JWT_SECRET', value);
  if (secret.trim().length < 32) {
    console.error('[env] FATAL: JWT_SECRET must be at least 32 characters long.');
    process.exit(1);
  }
  return secret;
}

const jwtDurationMultipliers: Record<string, number> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
  y: 365.25 * 24 * 60 * 60,
};

export function parseJwtExpiresInSeconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d|w|y)?$/i.exec(value.trim());
  if (!match) {
    throw new Error('Invalid JWT_EXPIRES_IN format');
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const seconds = amount * jwtDurationMultipliers[unit]!;
  const maxAgeMs = seconds * 1000;

  if (
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    !Number.isSafeInteger(maxAgeMs)
  ) {
    throw new Error('JWT_EXPIRES_IN must be a positive whole-second duration');
  }

  return seconds;
}

function parseJwtExpiration(raw: string | undefined): { value: string; seconds: number } {
  const value = raw ?? '7d';
  try {
    return { value, seconds: parseJwtExpiresInSeconds(value) };
  } catch {
    console.error(
      '[env] FATAL: JWT_EXPIRES_IN must be a positive duration such as 7d, 24h, 3600s, or 5000ms.'
    );
    process.exit(1);
  }
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

function parseSmtpSettings(nodeEnv: NodeEnv) {
  const values = {
    host: process.env.SMTP_HOST?.trim(),
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE?.trim() || undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM?.trim(),
  };
  const anyConfigured = Object.values(values).some((value) => value !== undefined && value !== '');
  if (!anyConfigured && nodeEnv !== 'production') return {};

  const requiredNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const;
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(`[env] FATAL: Email delivery configuration is incomplete (${missing.join(', ')}).`);
    process.exit(1);
  }

  const smtpPort = Number(values.port);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    console.error('[env] FATAL: SMTP_PORT must be an integer between 1 and 65535.');
    process.exit(1);
  }
  if (values.secure !== undefined && !['true', 'false'].includes(values.secure.toLowerCase())) {
    console.error('[env] FATAL: SMTP_SECURE must be true or false.');
    process.exit(1);
  }

  return {
    SMTP_HOST: values.host!,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: values.secure === undefined ? smtpPort === 465 : values.secure.toLowerCase() === 'true',
    SMTP_USER: values.user!,
    SMTP_PASS: values.pass!,
    EMAIL_FROM: values.from!,
  };
}

const jwtExpiration = parseJwtExpiration(process.env.JWT_EXPIRES_IN);
const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const port = parsePort(process.env.PORT);
const smtpSettings = parseSmtpSettings(nodeEnv);

export const env: Env = {
  NODE_ENV: nodeEnv,
  PORT: port,
  MONGODB_URI: assertRequired('MONGODB_URI', process.env.MONGODB_URI),
  JWT_SECRET: assertJwtSecret(process.env.JWT_SECRET),
  JWT_EXPIRES_IN: jwtExpiration.value,
  JWT_EXPIRES_IN_SECONDS: jwtExpiration.seconds,
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  ...smtpSettings,
  AI_PROVIDER: process.env.AI_PROVIDER || undefined,
  AI_API_KEY: process.env.AI_API_KEY || undefined,
};

// Warn (not crash) when AI config is absent — it is optional until the AI service is activated
if (!env.AI_PROVIDER || !env.AI_API_KEY) {
  console.warn('[env] AI_PROVIDER and/or AI_API_KEY are not set. AI features will be unavailable.');
}
