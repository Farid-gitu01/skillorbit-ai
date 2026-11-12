import api from './api';
import { resumeService } from './resume.service';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';
import type { Application, ApplicationStatus } from '@/types/application.types';
import type {
  EmployerApplicationsQuery,
  EmployerApplicationsResponse,
  EmployerCandidateDetail,
  EmployerCandidatesQuery,
  EmployerCandidatesResponse,
  EmployerDashboardData,
  EmployerJobPayload,
  EmployerJobsQuery,
  EmployerJobsResponse,
  Organization,
  OrganizationCompletion,
  SkillOption,
  UpsertOrganizationPayload,
} from '@/types/employer.types';
import type { Job, JobStatus } from '@/types/job.types';

export const employerService = {
  async getDashboard(): Promise<EmployerDashboardData> {
    const response = await api.get<ApiResponse<EmployerDashboardData>>('/employer/dashboard');
    return response.data.data;
  },

  async getOrganization(): Promise<{
    organization: Organization | null;
    completionPercentage: number;
    missingFields: OrganizationCompletion['missingFields'];
  }> {
    const response = await api.get<
      ApiResponse<{
        organization: Organization | null;
        completionPercentage: number;
        missingFields: string[];
      }>
    >('/employer/organization');
    return response.data.data;
  },

  async saveOrganization(payload: UpsertOrganizationPayload): Promise<{
    organization: Organization;
    completionPercentage: number;
    missingFields: string[];
    message: string;
  }> {
    const response = await api.put<
      ApiResponse<{
        organization: Organization;
        completionPercentage: number;
        missingFields: string[];
      }>
    >('/employer/organization', payload);
    return {
      ...response.data.data,
      message: response.data.message ?? 'Organization profile saved successfully',
    };
  },

  async getJobs(
    query: EmployerJobsQuery = {}
  ): Promise<EmployerJobsResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<EmployerJobsResponse> & { meta: PaginationMeta }
    >('/jobs/employer', {
      params: {
        q: query.q || undefined,
        status: query.status || 'all',
        locationType: query.locationType || undefined,
        type: query.type || undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        sort: query.sort ?? 'newest',
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta as unknown as PaginationMeta,
    };
  },

  async getJobById(id: string): Promise<Job> {
    const response = await api.get<ApiResponse<{ job: Job }>>(`/jobs/${id}`);
    return response.data.data.job;
  },

  async createJob(
    payload: EmployerJobPayload
  ): Promise<{ job: Job; message: string }> {
    const response = await api.post<ApiResponse<{ job: Job }>>('/jobs', payload);
    return {
      job: response.data.data.job,
      message: response.data.message ?? 'Job created successfully',
    };
  },

  async updateJob(
    id: string,
    payload: EmployerJobPayload
  ): Promise<{ job: Job; message: string }> {
    const response = await api.put<ApiResponse<{ job: Job }>>(`/jobs/${id}`, payload);
    return {
      job: response.data.data.job,
      message: response.data.message ?? 'Job updated successfully',
    };
  },

  async updateJobStatus(
    id: string,
    status: Extract<JobStatus, 'draft' | 'active' | 'closed'>
  ): Promise<{ job: Job; message: string }> {
    const response = await api.patch<ApiResponse<{ job: Job }>>(`/jobs/${id}/status`, {
      status,
    });
    return {
      job: response.data.data.job,
      message: response.data.message ?? `Job marked as ${status}`,
    };
  },

  async deleteJob(id: string): Promise<void> {
    await api.delete(`/jobs/${id}`);
  },

  async searchSkills(q: string): Promise<SkillOption[]> {
    const response = await api.get<ApiResponse<{ skills: SkillOption[] }>>('/jobs/skills', {
      params: { q: q || undefined },
    });
    return response.data.data.skills;
  },

  async getApplications(
    query: EmployerApplicationsQuery = {}
  ): Promise<EmployerApplicationsResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<EmployerApplicationsResponse> & { meta: PaginationMeta }
    >('/applications/employer', {
      params: {
        jobId: query.jobId || undefined,
        status: query.status || 'all',
        q: query.q || undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        sort: query.sort ?? 'newest',
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta as unknown as PaginationMeta,
    };
  },

  async getApplicationById(id: string): Promise<Application> {
    const response = await api.get<ApiResponse<{ application: Application }>>(
      `/applications/${id}`
    );
    return response.data.data.application;
  },

  async updateApplicationStatus(
    id: string,
    status: Exclude<ApplicationStatus, 'withdrawn'>,
    employerNote?: string
  ): Promise<{ application: Application; message: string }> {
    const body =
      employerNote !== undefined ? { status, employerNote } : { status };
    const response = await api.patch<ApiResponse<{ application: Application }>>(
      `/applications/${id}/status`,
      body
    );
    return {
      application: response.data.data.application,
      message: response.data.message ?? `Application marked as ${status}`,
    };
  },

  async updateApplicationNote(
    id: string,
    employerNote: string
  ): Promise<{ application: Application; message: string }> {
    const response = await api.patch<ApiResponse<{ application: Application }>>(
      `/applications/${id}/note`,
      { employerNote }
    );
    return {
      application: response.data.data.application,
      message: response.data.message ?? 'Application note updated successfully',
    };
  },

  async getCandidates(
    query: EmployerCandidatesQuery = {}
  ): Promise<EmployerCandidatesResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<EmployerCandidatesResponse> & { meta: PaginationMeta }
    >('/employer/candidates', {
      params: {
        q: query.q || undefined,
        status: query.status || 'all',
        jobId: query.jobId || undefined,
        shortlistedOnly: query.shortlistedOnly ? 'true' : undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta as unknown as PaginationMeta,
    };
  },

  async getCandidateById(candidateId: string): Promise<EmployerCandidateDetail> {
    const response = await api.get<ApiResponse<{ candidate: EmployerCandidateDetail }>>(
      `/employer/candidates/${candidateId}`
    );
    return response.data.data.candidate;
  },

  async downloadCandidateResume(resumeId: string, fileName: string): Promise<void> {
    await resumeService.downloadResume(resumeId, fileName);
  },
};
