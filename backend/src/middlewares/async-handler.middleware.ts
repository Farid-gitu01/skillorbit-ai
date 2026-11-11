import { type RequestHandler } from 'express';

/** Forward rejected async route/middleware promises to Express 4's error pipeline. */
export const asyncHandler = (
  handler: (...args: Parameters<RequestHandler>) => Promise<unknown>
): RequestHandler => (req, res, next) => {
  void Promise.resolve(handler(req, res, next)).catch(next);
};
