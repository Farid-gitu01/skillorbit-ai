import api from './api';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';
import type {
  AdminAuditLogsQuery,
  AdminCourseRecord,
  AdminCoursesQuery,
  AdminDashboardData,
  AdminEmployerDetailData,
  AdminJobsQuery,
  AdminJobRecord,
  AdminOrganizationSummary,
  AdminPaginatedAuditLogsResponse,
  AdminPaginatedCoursesResponse,
  AdminPaginatedEmployersResponse,
  AdminPaginatedJobsResponse,
  AdminPaginatedProvidersResponse,
  AdminPaginatedUsersResponse,
  AdminPaginatedVerificationsResponse,
  AdminPartnersQuery,
  AdminProviderDetailData,
  AdminUserDetailData,
  AdminUserRecord,
  AdminUsersQuery,
  AdminVerificationsQuery,
  ContentModerationStatus,
  OrganizationVerificationStatus,
} from '@/types/admin.types';

function toPaginationMeta(meta?: Record<string, unknown>): PaginationMeta | undefined {
  if (!meta) return undefined;
  return {
    page: typeof meta.page === 'number' ? meta.page : 1,
    limit: typeof meta.limit === 'number' ? meta.limit : 12,
    total: typeof meta.total === 'number' ? meta.total : 0,
    pages: typeof meta.pages === 'number' ? meta.pages : 1,
  };
}

export const adminService = {
  async getDashboard(): Promise<AdminDashboardData> {
    const response = await api.get<ApiResponse<AdminDashboardData>>('/admin/dashboard');
    return response.data.data;
  },

  async getUsers(query: AdminUsersQuery = {}): Promise<AdminPaginatedUsersResponse> {
    const response = await api.get<ApiResponse<{ users: AdminUserRecord[] }>>('/admin/users', {
      params: {
        q: query.q || undefined,
        role: query.role && query.role !== 'all' ? query.role : undefined,
        status: query.status && query.status !== 'all' ? query.status : undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      users: response.data.data.users,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async getUserById(id: string): Promise<AdminUserDetailData> {
    const response = await api.get<ApiResponse<AdminUserDetailData>>(`/admin/users/${id}`);
    return response.data.data;
  },

  async updateUserStatus(
    id: string,
    payload: { isActive: boolean; reason?: string }
  ): Promise<{ user: AdminUserRecord; message: string }> {
    const response = await api.patch<ApiResponse<{ user: AdminUserRecord }>>(
      `/admin/users/${id}/status`,
      payload
    );
    return {
      user: response.data.data.user,
      message: response.data.message ?? 'User account status updated',
    };
  },

  async getEmployers(query: AdminPartnersQuery = {}): Promise<AdminPaginatedEmployersResponse> {
    const response = await api.get<ApiResponse<AdminPaginatedEmployersResponse>>('/admin/employers', {
      params: {
        q: query.q || undefined,
        accountStatus:
          query.accountStatus && query.accountStatus !== 'all' ? query.accountStatus : undefined,
        verificationStatus:
          query.verificationStatus && query.verificationStatus !== 'all'
            ? query.verificationStatus
            : undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      employers: response.data.data.employers,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async getEmployerById(id: string): Promise<AdminEmployerDetailData> {
    const response = await api.get<ApiResponse<{ employer: AdminEmployerDetailData }>>(
      `/admin/employers/${id}`
    );
    return response.data.data.employer;
  },

  async getProviders(query: AdminPartnersQuery = {}): Promise<AdminPaginatedProvidersResponse> {
    const response = await api.get<ApiResponse<AdminPaginatedProvidersResponse>>('/admin/providers', {
      params: {
        q: query.q || undefined,
        accountStatus:
          query.accountStatus && query.accountStatus !== 'all' ? query.accountStatus : undefined,
        verificationStatus:
          query.verificationStatus && query.verificationStatus !== 'all'
            ? query.verificationStatus
            : undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      providers: response.data.data.providers,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async getProviderById(id: string): Promise<AdminProviderDetailData> {
    const response = await api.get<ApiResponse<{ provider: AdminProviderDetailData }>>(
      `/admin/providers/${id}`
    );
    return response.data.data.provider;
  },

  async getVerifications(
    query: AdminVerificationsQuery = {}
  ): Promise<AdminPaginatedVerificationsResponse> {
    const response = await api.get<ApiResponse<{ organizations: AdminOrganizationSummary[] }>>(
      '/admin/verifications',
      {
        params: {
          q: query.q || undefined,
          type: query.type && query.type !== 'all' ? query.type : undefined,
          status: query.status ?? 'pending',
          sort: query.sort ?? 'newest',
          page: query.page ?? 1,
          limit: query.limit ?? 12,
        },
      }
    );
    return {
      organizations: response.data.data.organizations,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async reviewVerification(
    orgId: string,
    payload: { status: Extract<OrganizationVerificationStatus, 'verified' | 'rejected'>; reason: string }
  ): Promise<{ organization: AdminOrganizationSummary; message: string }> {
    const response = await api.patch<ApiResponse<{ organization: AdminOrganizationSummary }>>(
      `/admin/verifications/${orgId}`,
      payload
    );
    return {
      organization: response.data.data.organization,
      message: response.data.message ?? 'Verification status updated',
    };
  },

  async getJobs(query: AdminJobsQuery = {}): Promise<AdminPaginatedJobsResponse> {
    const response = await api.get<ApiResponse<{ jobs: AdminJobRecord[] }>>('/admin/jobs', {
      params: {
        q: query.q || undefined,
        status: query.status && query.status !== 'all' ? query.status : undefined,
        moderationStatus:
          query.moderationStatus && query.moderationStatus !== 'all'
            ? query.moderationStatus
            : undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      jobs: response.data.data.jobs,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async getJobById(id: string): Promise<AdminJobRecord> {
    const response = await api.get<ApiResponse<{ job: AdminJobRecord }>>(`/admin/jobs/${id}`);
    return response.data.data.job;
  },

  async moderateJob(
    id: string,
    payload: {
      moderationStatus: ContentModerationStatus;
      status?: 'active' | 'closed' | 'draft';
      reason: string;
    }
  ): Promise<{ job: AdminJobRecord; message: string }> {
    const response = await api.patch<ApiResponse<{ job: AdminJobRecord }>>(
      `/admin/jobs/${id}/moderate`,
      payload
    );
    return {
      job: response.data.data.job,
      message: response.data.message ?? 'Job moderation updated',
    };
  },

  async getCourses(query: AdminCoursesQuery = {}): Promise<AdminPaginatedCoursesResponse> {
    const response = await api.get<ApiResponse<{ courses: AdminCourseRecord[] }>>('/admin/courses', {
      params: {
        q: query.q || undefined,
        status: query.status && query.status !== 'all' ? query.status : undefined,
        moderationStatus:
          query.moderationStatus && query.moderationStatus !== 'all'
            ? query.moderationStatus
            : undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 12,
      },
    });
    return {
      courses: response.data.data.courses,
      meta: toPaginationMeta(response.data.meta),
    };
  },

  async moderateCourse(
    id: string,
    payload: {
      moderationStatus: ContentModerationStatus;
      status?: 'published' | 'archived' | 'draft';
      reason: string;
    }
  ): Promise<{ course: AdminCourseRecord; message: string }> {
    const response = await api.patch<ApiResponse<{ course: AdminCourseRecord }>>(
      `/admin/courses/${id}/moderate`,
      payload
    );
    return {
      course: response.data.data.course,
      message: response.data.message ?? 'Course moderation updated',
    };
  },

  async getAuditLogs(query: AdminAuditLogsQuery = {}): Promise<AdminPaginatedAuditLogsResponse> {
    const response = await api.get<ApiResponse<AdminPaginatedAuditLogsResponse>>('/admin/audit-logs', {
      params: {
        q: query.q || undefined,
        actorRole:
          query.actorRole && query.actorRole !== 'all' ? query.actorRole : undefined,
        resource: query.resource && query.resource !== 'all' ? query.resource : undefined,
        action: query.action || undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
    });
    return {
      logs: response.data.data.logs,
      meta: toPaginationMeta(response.data.meta),
    };
  },
};
