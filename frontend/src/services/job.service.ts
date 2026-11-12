import { api } from './api';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';
import type { Job, JobFilterParams } from '@/types/job.types';

export const jobService = {
  async getJobs(params?: JobFilterParams): Promise<{ jobs: Job[]; meta: PaginationMeta }> {
    const cleanParams: Record<string, string | number> = {};
    if (params) {
      if (params.q) cleanParams.q = params.q;
      if (params.location) cleanParams.location = params.location;
      if (params.locationType) cleanParams.locationType = params.locationType;
      if (params.type) cleanParams.type = params.type;
      if (params.experienceLevel) cleanParams.experienceLevel = params.experienceLevel;
      if (params.page) cleanParams.page = params.page;
      if (params.limit) cleanParams.limit = params.limit;
      if (params.sort) cleanParams.sort = params.sort;
    }

    const response = await api.get<ApiResponse<{ jobs: Job[] }> & { meta: PaginationMeta }>('/jobs', {
      params: cleanParams,
    });
    return {
      jobs: response.data.data.jobs,
      meta: response.data.meta as unknown as PaginationMeta,
    };
  },

  async getJobById(id: string): Promise<Job> {
    const response = await api.get<ApiResponse<{ job: Job }>>(`/jobs/${id}`);
    return response.data.data.job;
  },

  async getRecommendedJobs(): Promise<Job[]> {
    const response = await api.get<ApiResponse<{ jobs: Job[] }>>('/jobs/recommended');
    return response.data.data.jobs;
  },

  async getSavedJobs(): Promise<Job[]> {
    const response = await api.get<ApiResponse<{ jobs: Job[] }>>('/jobs/saved');
    return response.data.data.jobs;
  },

  async saveJob(id: string): Promise<void> {
    await api.post(`/jobs/${id}/save`);
  },

  async unsaveJob(id: string): Promise<void> {
    await api.delete(`/jobs/${id}/save`);
  },
};
