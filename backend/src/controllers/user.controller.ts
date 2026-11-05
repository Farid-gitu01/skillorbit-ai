// User controller: getProfile, updateProfile, deleteAccount
import { type Request, type Response } from 'express';

export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: 'getProfile – not yet implemented' });
};
