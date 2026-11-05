import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

export interface AuthRequest extends Request {
  userId?: string;
}

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authorised – no token' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: 'Not authorised – invalid token' });
  }
};
