import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/constants';

export const generateToken = (userId: string): string =>
  jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
