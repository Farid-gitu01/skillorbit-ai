import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../utils/token.util.js';
import type { UserRole } from '../models/index.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

/**
 * protect — verifies the Bearer JWT and attaches userId + userRole to the request.
 */
export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Not authorised – no token' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1]!;
    const decoded = verifyToken(token);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Not authorised – invalid or expired token' });
  }
};

/**
 * restrictTo — must be used after protect().
 * Returns a middleware that allows only the specified roles.
 */
export const restrictTo = (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ success: false, message: 'Forbidden – insufficient permissions' });
      return;
    }
    next();
  };
