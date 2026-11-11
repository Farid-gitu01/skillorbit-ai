import { type Request, type Response, type NextFunction } from 'express';
import { sendError } from '../utils/api-response.util.js';

/**
 * notFound — 404 middleware
 *
 * Catches any request that reaches this middleware without being handled
 * by a registered route and returns a consistent JSON 404 response.
 * Must be registered after all route handlers and before the error handler.
 */
export const notFound = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  sendError(res, 404, `Route not found: ${req.method} ${req.path}`, { code: 'ROUTE_NOT_FOUND' });
};
