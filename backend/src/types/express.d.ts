import type { UserRole } from '../models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      authUser?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export {};
