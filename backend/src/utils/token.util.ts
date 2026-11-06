import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/constants.js';

export interface TokenPayload {
  id: string;
}

export const generateToken = (userId: string): string =>
  jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

/**
 * Verify a JWT and return the decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError if invalid.
 */
export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, JWT_SECRET) as TokenPayload;
