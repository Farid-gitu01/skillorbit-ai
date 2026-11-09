// User controller: getProfile, updateProfile, deleteAccount
import { type Request, type Response } from 'express';

export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  const user = _req.authUser;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  });
};
