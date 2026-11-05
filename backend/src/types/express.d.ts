// Backend-specific TypeScript type declarations
import { type Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}
