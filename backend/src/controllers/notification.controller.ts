import { type Request, type Response } from 'express';
import { Notification } from '../models/Notification.model.js';
import { sendError, sendSuccess } from '../utils/api-response.util.js';

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  sendSuccess(res, 200, { notifications, unreadCount });
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    sendError(res, 404, 'Notification not found', { code: 'NOTIFICATION_NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, { notification }, 'Marked as read');
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  sendSuccess(res, 200, { success: true }, 'All notifications marked as read');
};
