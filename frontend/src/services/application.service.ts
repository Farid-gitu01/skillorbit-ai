import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { Application, ApplyJobPayload } from '@/types/application.types';

export const applicationService = {
  async getMyApplications(status?: string): Promise<Application[]> {
    const params = status && status !== 'all' ? { status } : undefined;
    const response = await api.get<ApiResponse<{ applications: Application[] }>>('/applications/me', {
      params,
    });
    return response.data.data.applications;
  },

  async applyForJob(payload: ApplyJobPayload): Promise<Application> {
    const response = await api.post<ApiResponse<{ application: Application }>>('/applications', payload);
    return response.data.data.application;
  },

  async getApplicationById(id: string): Promise<Application> {
    const response = await api.get<ApiResponse<{ application: Application }>>(`/applications/${id}`);
    return response.data.data.application;
  },

  async withdrawApplication(id: string): Promise<Application> {
    const response = await api.post<ApiResponse<{ application: Application }>>(`/applications/${id}/withdraw`);
    return response.data.data.application;
  },
};
