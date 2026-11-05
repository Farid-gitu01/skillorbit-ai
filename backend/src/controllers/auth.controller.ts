// Auth controller: register, login, logout, refresh token
import { type Request, type Response, type NextFunction } from 'express';

export const register = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  res.status(201).json({ message: 'register – not yet implemented' });
};

export const login = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  res.status(200).json({ message: 'login – not yet implemented' });
};
