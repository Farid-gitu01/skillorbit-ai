export type JobLocationType = 'on-site' | 'remote' | 'hybrid';
export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type JobStatus = 'draft' | 'active' | 'closed' | 'expired';

export interface Salary {
  min?: number;
  max?: number;
  currency?: string;
  isPublic: boolean;
}

export interface JobOrganization {
  _id: string;
  name: string;
  logo?: string;
  logoUrl?: string;
  website?: string;
  websiteUrl?: string;
  industry?: string;
  size?: string;
  description?: string;
  location?: string;
}

export interface JobSkill {
  _id: string;
  name: string;
  category?: string;
}

export interface Job {
  _id: string;
  employer: string;
  organization?: JobOrganization;
  title: string;
  description: string;
  responsibilities?: string[];
  qualifications?: string[];
  skills: JobSkill[];
  location?: string;
  locationType?: JobLocationType;
  type?: JobType;
  salary?: Salary;
  experienceLevel?: ExperienceLevel;
  openings?: number;
  applicationDeadline?: string;
  applicantCount: number;
  status: JobStatus;
  isSaved?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilterParams {
  q?: string;
  location?: string;
  locationType?: JobLocationType | '';
  type?: JobType | '';
  experienceLevel?: ExperienceLevel | '';
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'deadline';
}
