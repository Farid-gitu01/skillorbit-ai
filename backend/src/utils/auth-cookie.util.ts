import { type CookieOptions } from 'express';
import { IS_PRODUCTION } from '../config/constants.js';
import { getTokenMaxAgeMs } from './token.util.js';

export const AUTH_COOKIE_NAME = 'skillorbit_access';

const authCookieScope: Pick<CookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path'> = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  path: '/',
};

export const getAuthCookieOptions = (token: string): CookieOptions => ({
  ...authCookieScope,
  maxAge: getTokenMaxAgeMs(token),
});

export const getAuthCookieClearOptions = (): CookieOptions => ({ ...authCookieScope });
