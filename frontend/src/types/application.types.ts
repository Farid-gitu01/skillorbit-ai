import type { Job } from './job.types';
import type { Resume } from './resume.types';

export type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface AIMatchDetails {
  matchedSkills?: string[];
  missingSkills?: string[];
  experienceMatch?: boolean;
  summary?: string;
}

export interface ApplicationStatusHistoryItem {
  status: ApplicationStatus;
  changedBy?: string | { _id: string; name: string; role?: string };
  note?: string;
  changedAt: string;
}

export interface CandidateExperienceItem {
  _id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface CandidateEducationItem {
  _id?: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface CandidateProfileSummary {
  headline?: string;
  bio?: string;
  location?: string;
  phone?: string;
  avatarUrl?: string;
  availability?: string;
  skills?: string[];
  languages?: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  experienceCount?: number;
  educationCount?: number;
  experience?: CandidateExperienceItem[];
  education?: CandidateEducationItem[];
}

export interface Application {
  _id: string;
  seeker: string | { _id: string; name: string; email: string };
  job: Job;
  resume?: Resume;
  coverLetter?: string;
  status: ApplicationStatus;
  aiMatchScore?: number;
  aiMatchDetails?: AIMatchDetails;
  employerNote?: string;
  statusHistory?: ApplicationStatusHistoryItem[];
  candidateProfile?: CandidateProfileSummary;
  withdrawnAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyJobPayload {
  jobId: string;
  resumeId?: string;
  coverLetter?: string;
}
