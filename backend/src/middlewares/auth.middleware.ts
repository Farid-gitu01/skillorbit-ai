import { type Request, type Response, type NextFunction } from 'express';
import { User } from '../models/user.model.js';
import type { UserRole } from '../models/user.model.js';
import { verifyToken } from '../utils/token.util.js';
import { AUTH_COOKIE_NAME } from '../utils/auth-cookie.util.js';

export type AuthRequest = Request;

/**
 * protect — verifies the HttpOnly-cookie JWT, loads the current eligible user,
 * and attaches only safe database-backed identity fields to the request.
 */
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication' });
    return;
  }

  try {
    const user = await User.findById(decoded.id).select('name email role createdAt updatedAt isActive isDeleted deletedAt');
    if (!user || user.isActive !== true || user.isDeleted === true || user.deletedAt != null) {
      res.status(401).json({ success: false, message: 'Invalid or expired authentication' });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * restrictTo — must be used after protect().
 * Returns a middleware that allows only the specified roles.
 */
export const restrictTo = (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ success: false, message: 'Forbidden – insufficient permissions' });
      return;
    }
    next();
  };
