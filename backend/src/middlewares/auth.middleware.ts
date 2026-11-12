import { type Request, type Response, type NextFunction } from 'express';
import { User } from '../models/user.model.js';
import type { UserRole } from '../models/user.model.js';
import { verifyToken } from '../utils/token.util.js';
import { AUTH_COOKIE_NAME } from '../utils/auth-cookie.util.js';
import { sendError } from '../utils/api-response.util.js';

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
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    sendError(res, 401, 'Invalid or expired authentication', { code: 'INVALID_AUTHENTICATION' });
    return;
  }

  try {
    const user = await User.findById(decoded.id).select('name email role createdAt updatedAt isActive isDeleted deletedAt');
    if (!user || user.isActive !== true || user.isDeleted === true || user.deletedAt != null) {
      sendError(res, 401, 'Invalid or expired authentication', { code: 'INVALID_AUTHENTICATION' });
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
      sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      sendError(res, 403, 'Forbidden – insufficient permissions', { code: 'FORBIDDEN' });
      return;
    }
    next();
  };

/**
 * optionalProtect — parses the HttpOnly-cookie JWT if present, attaching safe identity
 * to the request, but does NOT reject unauthenticated requests.
 */
export const optionalProtect = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) {
    next();
    return;
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('name email role createdAt updatedAt isActive isDeleted deletedAt');
    if (user && user.isActive === true && !user.isDeleted && user.deletedAt == null) {
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
    }
  } catch {
    // Continue unauthenticated on bad token
  }

  next();
};

