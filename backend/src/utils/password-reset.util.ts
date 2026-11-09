import { createHash, randomBytes } from 'node:crypto';

export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const generatePasswordResetToken = (): string => randomBytes(32).toString('hex');

export const hashPasswordResetToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');
