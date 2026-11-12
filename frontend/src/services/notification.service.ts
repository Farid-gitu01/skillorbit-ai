import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { Notification } from '@/types/notification.types';

export const notificationService = {
  async getMyNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const response = await api.get<ApiResponse<{ notifications: Notification[]; unreadCount: number }>>(
      '/notifications'
    );
    return response.data.data;
  },

  async markAsRead(id: string): Promise<Notification> {
    const response = await api.patch<ApiResponse<{ notification: Notification }>>(
      `/notifications/${id}/read`
    );
    return response.data.data.notification;
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};
