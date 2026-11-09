import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN_SECONDS } from '../config/constants.js';

export interface TokenPayload {
  id: string;
}

const objectIdPattern = /^[a-f\d]{24}$/i;

export const generateToken = (userId: string): string => {
  if (!objectIdPattern.test(userId)) {
    throw new Error('Cannot generate token for invalid user identity');
  }

  return jwt.sign(
    { id: userId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN_SECONDS }
  );
};

export const getTokenMaxAgeMs = (token: string): number => {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === 'string' || typeof payload.exp !== 'number') {
    throw new Error('Generated JWT is missing its expiration claim');
  }

  const maxAge = payload.exp * 1000 - Date.now();
  if (maxAge <= 0 || !Number.isSafeInteger(payload.exp)) {
    throw new Error('Generated JWT has an invalid expiration claim');
  }

  return maxAge;
};

/**
 * Verify a JWT and return the decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError if invalid.
 */
export const verifyToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.id !== 'string' ||
    !objectIdPattern.test(decoded.id) ||
    typeof decoded.exp !== 'number' ||
    !Number.isSafeInteger(decoded.exp)
  ) {
    throw new Error('Invalid token payload');
  }

  return { id: decoded.id };
};
