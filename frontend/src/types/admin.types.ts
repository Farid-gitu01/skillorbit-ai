import type { PaginationMeta } from './api.types';
import type { Organization } from './employer.types';
import type { Job } from './job.types';
import type { Notification } from './notification.types';
import type { Course } from './provider.types';
import type { UserRole } from './user.types';

export type OrganizationVerificationStatus = 'pending' | 'verified' | 'rejected';
export type ContentModerationStatus = 'approved' | 'flagged' | 'rejected';

export interface AdminVerificationHistoryItem {
  status: OrganizationVerificationStatus;
  reason?: string;
  changedBy?: string;
  changedAt: string;
}

export interface AdminModerationHistoryItem {
  status: ContentModerationStatus;
  reason?: string;
  changedBy?: string;
  changedAt: string;
}

export interface AdminUserRecord {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  suspensionReason?: string;
  suspendedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrganizationSummary extends Omit<Organization, 'owner' | 'type' | 'slug'> {
  slug?: string;
  type: 'employer' | 'training-provider';
  specialization?: string;
  verificationStatus: OrganizationVerificationStatus;
  verificationReason?: string;
  verifiedAt?: string;
  verificationHistory?: AdminVerificationHistoryItem[];
  owner?: AdminUserRecord | null;
}

export interface AdminAuditLogItem {
  _id: string;
  action: string;
  actorRole: UserRole | 'system';
  resource: string;
  resourceId?: string;
  title: string;
  description: string;
  changes?: Record<string, unknown>;
  statusCode?: number;
  createdAt: string;
  actor?: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface AdminDashboardStats {
  totalUsers: number;
  seekersCount: number;
  employersCount: number;
  providersCount: number;
  adminsCount: number;
  activeAccountsCount: number;
  suspendedAccountsCount: number;
  totalJobs: number;
  activeJobsCount: number;
  draftJobsCount: number;
  closedJobsCount: number;
  flaggedJobsCount: number;
  rejectedJobsCount: number;
  totalCourses: number;
  publishedCoursesCount: number;
  flaggedCoursesCount: number;
  rejectedCoursesCount: number;
  totalApplications: number;
  totalOrganizations: number;
  verifiedOrganizationsCount: number;
  rejectedOrganizationsCount: number;
  pendingVerificationsCount: number;
  unreadNotificationsCount: number;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentUsers: AdminUserRecord[];
  pendingVerifications: AdminOrganizationSummary[];
  recentActivities: AdminAuditLogItem[];
  recentNotifications: Notification[];
}

export interface AdminUsersQuery {
  q?: string;
  role?: 'all' | UserRole;
  status?: 'all' | 'active' | 'suspended';
  sort?: 'newest' | 'oldest' | 'name';
  page?: number;
  limit?: number;
}

export interface AdminUserRoleSummary {
  type: UserRole;
  profile?: {
    headline?: string;
    bio?: string;
    location?: string;
    availability?: string;
    skillsCount: number;
    experienceCount: number;
    educationCount: number;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    updatedAt?: string;
  } | null;
  applicationsCount?: number;
  resumesCount?: number;
  organization?: AdminOrganizationSummary | null;
  totalJobs?: number;
  activeJobs?: number;
  totalCourses?: number;
  publishedCourses?: number;
}

export interface AdminUserDetailData {
  user: AdminUserRecord;
  roleSummary: AdminUserRoleSummary;
  activities: AdminAuditLogItem[];
}

export interface AdminPartnersQuery {
  q?: string;
  accountStatus?: 'all' | 'active' | 'suspended';
  verificationStatus?: 'all' | OrganizationVerificationStatus;
  sort?: 'newest' | 'oldest' | 'name';
  page?: number;
  limit?: number;
}

export interface AdminEmployerRecord {
  user: AdminUserRecord;
  organization: AdminOrganizationSummary | null;
  verificationStatus: OrganizationVerificationStatus;
  metrics: {
    totalJobs: number;
    activeJobs: number;
  };
}

export interface AdminProviderRecord {
  user: AdminUserRecord;
  organization: AdminOrganizationSummary | null;
  verificationStatus: OrganizationVerificationStatus;
  metrics: {
    totalCourses: number;
    publishedCourses: number;
    totalEnrollments: number;
  };
}

export interface AdminEmployerDetailData {
  user: AdminUserRecord;
  organization: AdminOrganizationSummary | null;
  jobs: Job[];
  activities: AdminAuditLogItem[];
}

export interface AdminProviderDetailData {
  user: AdminUserRecord;
  organization: AdminOrganizationSummary | null;
  courses: Course[];
  activities: AdminAuditLogItem[];
}

export interface AdminVerificationsQuery {
  q?: string;
  type?: 'all' | 'employer' | 'training-provider';
  status?: 'all' | OrganizationVerificationStatus;
  sort?: 'newest' | 'oldest' | 'name';
  page?: number;
  limit?: number;
}

export interface AdminJobsQuery {
  q?: string;
  status?: 'all' | 'draft' | 'active' | 'closed' | 'expired';
  moderationStatus?: 'all' | ContentModerationStatus;
  sort?: 'newest' | 'oldest' | 'applicants';
  page?: number;
  limit?: number;
}

export interface AdminCoursesQuery {
  q?: string;
  status?: 'all' | 'draft' | 'published' | 'archived';
  moderationStatus?: 'all' | ContentModerationStatus;
  sort?: 'newest' | 'oldest' | 'enrollments';
  page?: number;
  limit?: number;
}

export interface AdminAuditLogsQuery {
  q?: string;
  actorRole?: 'all' | UserRole | 'system';
  resource?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface AdminJobRecord extends Omit<Job, 'employer' | 'organization'> {
  employer?: AdminUserRecord | null;
  organization?: {
    _id: string;
    name: string;
    logoUrl?: string;
    location?: string;
    industry?: string;
    size?: string;
    websiteUrl?: string;
    isVerified?: boolean;
    verificationStatus?: OrganizationVerificationStatus;
  } | null;
  moderationStatus: ContentModerationStatus;
  moderationReason?: string;
  moderatedAt?: string;
  moderationHistory?: AdminModerationHistoryItem[];
}

export interface AdminCourseRecord extends Omit<Course, 'provider' | 'organization'> {
  provider?: AdminUserRecord | null;
  organization?: {
    _id: string;
    name: string;
    logoUrl?: string;
    location?: string;
    industry?: string;
    websiteUrl?: string;
    isVerified?: boolean;
    verificationStatus?: OrganizationVerificationStatus;
  } | null;
  moderationStatus: ContentModerationStatus;
  moderationReason?: string;
  moderatedAt?: string;
  moderationHistory?: AdminModerationHistoryItem[];
}

export interface AdminPaginatedUsersResponse {
  users: AdminUserRecord[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedEmployersResponse {
  employers: AdminEmployerRecord[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedProvidersResponse {
  providers: AdminProviderRecord[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedVerificationsResponse {
  organizations: AdminOrganizationSummary[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedJobsResponse {
  jobs: AdminJobRecord[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedCoursesResponse {
  courses: AdminCourseRecord[];
  meta?: PaginationMeta;
}

export interface AdminPaginatedAuditLogsResponse {
  logs: AdminAuditLogItem[];
  meta?: PaginationMeta;
}
