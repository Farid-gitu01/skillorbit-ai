import { type Request, type Response, type NextFunction } from 'express';

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
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
