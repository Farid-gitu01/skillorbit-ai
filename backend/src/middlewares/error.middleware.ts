import { type Request, type Response, type NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};
