import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { SeekerDashboardData } from '@/types/seeker-dashboard.types';

export const seekerService = {
  async getDashboardData(): Promise<SeekerDashboardData> {
    const response = await api.get<ApiResponse<SeekerDashboardData>>('/seeker/dashboard');
    return response.data.data;
  },
};
