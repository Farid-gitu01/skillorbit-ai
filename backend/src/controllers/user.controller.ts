// User controller: getProfile, updateProfile, deleteAccount
import { type Request, type Response } from 'express';
import { sendError, sendSuccess } from '../utils/api-response.util.js';

export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  const user = _req.authUser;
  if (!user) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  sendSuccess(res, 200, {
    user: {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
};
