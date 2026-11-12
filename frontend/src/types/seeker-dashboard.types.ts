import type { Application } from './application.types';
import type { Job } from './job.types';
import type { Notification } from './notification.types';
import type { AvailabilityStatus } from './profile.types';
import type { User } from './user.types';

export interface SeekerDashboardStats {
  total: number;
  pending: number;
  shortlisted: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
}

export interface SeekerDashboardData {
  user: User;
  profile: {
    headline?: string;
    bio?: string;
    location?: string;
    availability?: AvailabilityStatus;
    skills: string[];
  };
  profileCompletion: {
    percentage: number;
    missingFields: string[];
  };
  applicationStats: SeekerDashboardStats;
  savedJobsCount: number;
  recentApplications: Application[];
  recommendedJobs: Job[];
  recentActivity: Notification[];
  hasResume: boolean;
}
