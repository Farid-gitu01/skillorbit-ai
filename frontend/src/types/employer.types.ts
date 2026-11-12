import type { Application, ApplicationStatus, ApplicationStatusHistoryItem, CandidateProfileSummary } from './application.types';
import type { ExperienceLevel, Job, JobLocationType, JobStatus, JobType, Salary } from './job.types';
import type { Notification } from './notification.types';

export type OrganizationSize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';

export interface OrganizationSocialLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  github?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  type: 'employer' | 'training_provider';
  owner: string;
  industry?: string;
  size?: OrganizationSize;
  founded?: number;
  location?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: OrganizationSocialLinks;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationCompletion {
  percentage: number;
  missingFields: string[];
}

export interface UpsertOrganizationPayload {
  name: string;
  industry?: string;
  size?: OrganizationSize | '';
  founded?: number | '';
  location?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: OrganizationSocialLinks;
}

export interface EmployerJobStats {
  total: number;
  active: number;
  draft: number;
  closed: number;
  expired: number;
}

export interface EmployerApplicationStats {
  total: number;
  pending: number;
  reviewed: number;
  shortlisted: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
}

export interface EmployerActivityItem {
  _id: string;
  action: string;
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

export interface EmployerDashboardUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface EmployerDashboardData {
  user: EmployerDashboardUser | null;
  organization: Organization | null;
  organizationCompletion: OrganizationCompletion;
  jobStats: EmployerJobStats;
  applicationStats: EmployerApplicationStats;
  recentJobs: Job[];
  recentApplications: Application[];
  recentActivity: EmployerActivityItem[];
  notifications: Notification[];
  unreadNotificationsCount: number;
}

export interface EmployerJobsQuery {
  q?: string;
  status?: 'all' | JobStatus;
  locationType?: JobLocationType | '';
  type?: JobType | '';
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'deadline' | 'applicants';
}

export interface EmployerJobStatusCounts {
  all: number;
  active: number;
  draft: number;
  closed: number;
  expired: number;
}

export interface EmployerJobsResponse {
  jobs: Job[];
  statusCounts: EmployerJobStatusCounts;
}

export interface EmployerJobPayload {
  title: string;
  description: string;
  responsibilities: string[];
  qualifications: string[];
  skills: string[];
  location?: string;
  locationType: JobLocationType;
  type: JobType;
  experienceLevel: ExperienceLevel;
  openings: number;
  salary?: Salary;
  applicationDeadline?: string;
  status?: 'draft' | 'active' | 'closed';
}

export interface SkillOption {
  _id: string;
  name: string;
  category?: string;
}

export interface EmployerApplicationsQuery {
  jobId?: string;
  status?: 'all' | ApplicationStatus;
  q?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'match_desc';
}

export interface EmployerApplicationJobOption {
  _id: string;
  title: string;
  status: JobStatus;
}

export interface EmployerApplicationsStatusCounts {
  all: number;
  pending: number;
  reviewed: number;
  shortlisted: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
}

export interface EmployerApplicationsResponse {
  applications: Application[];
  jobs: EmployerApplicationJobOption[];
  statusCounts: EmployerApplicationsStatusCounts;
}

export interface EmployerCandidateResumeItem {
  _id: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  createdAt?: string;
}

export interface EmployerCandidateApplicationItem {
  _id: string;
  job: {
    _id: string;
    title: string;
    location?: string;
    locationType?: JobLocationType;
    type?: JobType;
    status?: JobStatus;
  };
  status: ApplicationStatus;
  aiMatchScore?: number;
  coverLetter?: string;
  employerNote?: string;
  statusHistory?: ApplicationStatusHistoryItem[];
  resume?: EmployerCandidateResumeItem;
  createdAt: string;
  updatedAt?: string;
}

export interface EmployerCandidateSummary {
  _id: string;
  name: string;
  email: string;
  profile: CandidateProfileSummary;
  applications: EmployerCandidateApplicationItem[];
  latestApplication: EmployerCandidateApplicationItem;
  isShortlisted: boolean;
  highestMatchScore: number;
}

export interface EmployerCandidatesResponse {
  candidates: EmployerCandidateSummary[];
  shortlistedCount: number;
}

export interface EmployerCandidateDetail {
  _id: string;
  name: string;
  email: string;
  profile: CandidateProfileSummary;
  applications: EmployerCandidateApplicationItem[];
  resumes: EmployerCandidateResumeItem[];
}

export interface EmployerCandidatesQuery {
  q?: string;
  status?: 'all' | Exclude<ApplicationStatus, 'withdrawn'>;
  jobId?: string;
  shortlistedOnly?: boolean;
  page?: number;
  limit?: number;
}
