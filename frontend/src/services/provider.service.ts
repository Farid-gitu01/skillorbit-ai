import api from './api';
import { employerService } from './employer.service';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';
import type { SkillOption } from '@/types/employer.types';
import type {
  Course,
  CoursePayload,
  CourseStatus,
  ProviderCompletion,
  ProviderCoursesQuery,
  ProviderCoursesResponse,
  ProviderDashboardData,
  ProviderEngagement,
  ProviderEngagementsQuery,
  ProviderEngagementsResponse,
  ProviderOrganization,
  UpdateEngagementPayload,
  UpsertProviderOrganizationPayload,
} from '@/types/provider.types';

export const providerService = {
  async getDashboard(): Promise<ProviderDashboardData> {
    const response = await api.get<ApiResponse<ProviderDashboardData>>('/provider/dashboard');
    return response.data.data;
  },

  async getProfile(): Promise<{
    organization: ProviderOrganization | null;
    completionPercentage: number;
    missingFields: ProviderCompletion['missingFields'];
  }> {
    const response = await api.get<
      ApiResponse<{
        organization: ProviderOrganization | null;
        completionPercentage: number;
        missingFields: string[];
      }>
    >('/provider/profile');
    return response.data.data;
  },

  async saveProfile(payload: UpsertProviderOrganizationPayload): Promise<{
    organization: ProviderOrganization;
    completionPercentage: number;
    missingFields: string[];
    message: string;
  }> {
    const response = await api.put<
      ApiResponse<{
        organization: ProviderOrganization;
        completionPercentage: number;
        missingFields: string[];
      }>
    >('/provider/profile', payload);
    return {
      ...response.data.data,
      message: response.data.message ?? 'Provider profile saved successfully',
    };
  },

  async getCourses(
    query: ProviderCoursesQuery = {}
  ): Promise<ProviderCoursesResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<ProviderCoursesResponse> & { meta: PaginationMeta }
    >('/courses/provider', {
      params: {
        q: query.q || undefined,
        status: query.status || 'all',
        level: query.level && query.level !== 'all' ? query.level : undefined,
        category: query.category || undefined,
        sort: query.sort ?? 'newest',
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta,
    };
  },

  async getCourseById(id: string): Promise<Course> {
    const response = await api.get<ApiResponse<{ course: Course }>>(`/courses/${id}`);
    return response.data.data.course;
  },

  async createCourse(payload: CoursePayload): Promise<{ course: Course; message: string }> {
    const response = await api.post<ApiResponse<{ course: Course }>>('/courses', payload);
    return {
      course: response.data.data.course,
      message: response.data.message ?? 'Course offering created successfully',
    };
  },

  async updateCourse(
    id: string,
    payload: Partial<CoursePayload>
  ): Promise<{ course: Course; message: string }> {
    const response = await api.put<ApiResponse<{ course: Course }>>(`/courses/${id}`, payload);
    return {
      course: response.data.data.course,
      message: response.data.message ?? 'Course offering updated successfully',
    };
  },

  async updateCourseStatus(
    id: string,
    status: CourseStatus
  ): Promise<{ course: Course; message: string }> {
    const response = await api.patch<ApiResponse<{ course: Course }>>(
      `/courses/${id}/status`,
      { status }
    );
    return {
      course: response.data.data.course,
      message: response.data.message ?? 'Course status updated successfully',
    };
  },

  async deleteCourse(id: string): Promise<{ deletedId: string; message: string }> {
    const response = await api.delete<ApiResponse<{ deletedId: string }>>(`/courses/${id}`);
    return {
      deletedId: response.data.data.deletedId,
      message: response.data.message ?? 'Course offering deleted successfully',
    };
  },

  async getEngagements(
    query: ProviderEngagementsQuery = {}
  ): Promise<ProviderEngagementsResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<ProviderEngagementsResponse> & { meta: PaginationMeta }
    >('/provider/engagements', {
      params: {
        q: query.q || undefined,
        courseId: query.courseId || undefined,
        status: query.status || 'all',
        type: query.type || 'all',
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta,
    };
  },

  async getCourseLearners(
    courseId: string,
    query: Omit<ProviderEngagementsQuery, 'courseId'> = {}
  ): Promise<ProviderEngagementsResponse & { meta: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<ProviderEngagementsResponse> & { meta: PaginationMeta }
    >(`/courses/${courseId}/learners`, {
      params: {
        q: query.q || undefined,
        status: query.status || 'all',
        type: query.type || 'all',
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      },
    });
    return {
      ...response.data.data,
      meta: response.data.meta,
    };
  },

  async getEngagementById(engagementId: string): Promise<ProviderEngagement> {
    const response = await api.get<ApiResponse<{ engagement: ProviderEngagement }>>(
      `/provider/engagements/${engagementId}`
    );
    return response.data.data.engagement;
  },

  async updateEngagement(
    engagementId: string,
    payload: UpdateEngagementPayload
  ): Promise<{ engagement: ProviderEngagement; message: string }> {
    const response = await api.patch<ApiResponse<{ engagement: ProviderEngagement }>>(
      `/provider/engagements/${engagementId}`,
      payload
    );
    return {
      engagement: response.data.data.engagement,
      message: response.data.message ?? 'Learner engagement updated successfully',
    };
  },

  async searchSkills(q: string): Promise<SkillOption[]> {
    return employerService.searchSkills(q);
  },
};
