import type {
  EmployerDashboardUser,
  OrganizationCompletion,
  OrganizationSize,
  OrganizationSocialLinks,
  SkillOption,
} from './employer.types';
import type { Notification } from './notification.types';

export type ProviderDashboardUser = EmployerDashboardUser;
export type ProviderCompletion = OrganizationCompletion;

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseDeliveryMode = 'self-paced' | 'live-cohort' | 'hybrid';
export type EngagementType = 'enrollment' | 'enquiry';
export type EngagementStatus =
  | 'pending'
  | 'enrolled'
  | 'active'
  | 'completed'
  | 'declined'
  | 'withdrawn';

export interface ProviderOrganization {
  _id: string;
  owner: string;
  name: string;
  type: 'training-provider';
  specialization?: string;
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

export interface UpsertProviderOrganizationPayload {
  name: string;
  specialization?: string;
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

export interface SyllabusModule {
  moduleTitle: string;
  lessons: string[];
  duration?: number;
}

export interface Course {
  _id: string;
  provider: string | { _id: string; name: string };
  organization?:
    | string
    | {
        _id: string;
        name: string;
        logoUrl?: string;
        location?: string;
        industry?: string;
        specialization?: string;
        websiteUrl?: string;
        isVerified?: boolean;
      };
  title: string;
  description: string;
  category?: string;
  skills: Array<SkillOption | string>;
  level?: CourseLevel;
  deliveryMode?: CourseDeliveryMode;
  duration?: number;
  price: number;
  currency: string;
  certificationOffered: boolean;
  thumbnailUrl?: string;
  externalUrl?: string;
  syllabus: SyllabusModule[];
  tags: string[];
  enrollmentCount: number;
  pendingEngagementsCount?: number;
  rating?: number;
  ratingCount: number;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CoursePayload {
  title: string;
  description: string;
  category?: string;
  level: CourseLevel;
  deliveryMode?: CourseDeliveryMode;
  duration?: number;
  price: number;
  currency: string;
  certificationOffered: boolean;
  skills: string[];
  tags: string[];
  thumbnailUrl?: string;
  externalUrl?: string;
  syllabus: SyllabusModule[];
  status?: CourseStatus;
}

export interface ProviderCourseStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  totalEnrollments: number;
  averageRating: number | null;
}

export interface ProviderEngagementStats {
  total: number;
  pending: number;
  enrolled: number;
  active: number;
  completed: number;
  declined: number;
  enquiries: number;
}

export interface LearnerExperienceItem {
  _id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface LearnerEducationItem {
  _id?: string;
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
}

export interface LearnerProfileSummary {
  _id: string;
  name: string;
  profile: {
    headline?: string;
    bio?: string;
    location?: string;
    avatarUrl?: string;
    availability?: string;
    skills: string[];
    languages: string[];
    experience: LearnerExperienceItem[];
    education: LearnerEducationItem[];
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
}

export interface EngagementStatusHistoryItem {
  status: EngagementStatus;
  changedBy?: string;
  note?: string;
  changedAt: string;
}

export interface ProviderEngagementCourseRef {
  _id: string;
  title: string;
  level?: CourseLevel;
  category?: string;
  deliveryMode?: CourseDeliveryMode;
  status: CourseStatus;
}

export interface ProviderEngagement {
  _id: string;
  course: ProviderEngagementCourseRef;
  learner: LearnerProfileSummary;
  type: EngagementType;
  status: EngagementStatus;
  progress: number;
  learnerMessage?: string;
  providerNote?: string;
  statusHistory: EngagementStatusHistoryItem[];
  enrolledAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface ProviderActivityItem {
  _id: string;
  action: string;
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

export interface ProviderDashboardData {
  user: ProviderDashboardUser | null;
  organization: ProviderOrganization | null;
  organizationCompletion: ProviderCompletion;
  courseStats: ProviderCourseStats;
  engagementStats: ProviderEngagementStats;
  recentCourses: Course[];
  recentEngagements: ProviderEngagement[];
  recentActivity: ProviderActivityItem[];
  notifications: Notification[];
  unreadNotificationsCount: number;
}

export interface ProviderCoursesQuery {
  q?: string;
  status?: 'all' | CourseStatus;
  level?: 'all' | CourseLevel;
  category?: string;
  sort?: 'newest' | 'oldest' | 'enrollments_desc' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export interface ProviderCourseStatusCounts {
  all: number;
  published: number;
  draft: number;
  archived: number;
}

export interface ProviderCoursesResponse {
  courses: Course[];
  statusCounts: ProviderCourseStatusCounts;
}

export interface ProviderEngagementsQuery {
  q?: string;
  courseId?: string;
  status?: 'all' | EngagementStatus;
  type?: 'all' | EngagementType;
  page?: number;
  limit?: number;
}

export interface ProviderEngagementCourseOption {
  _id: string;
  title: string;
}

export interface ProviderEngagementsResponse {
  engagements: ProviderEngagement[];
  stats: ProviderEngagementStats;
  courses: ProviderEngagementCourseOption[];
}

export interface UpdateEngagementPayload {
  status?: 'pending' | 'enrolled' | 'active' | 'completed' | 'declined';
  progress?: number;
  providerNote?: string;
  note?: string;
}
