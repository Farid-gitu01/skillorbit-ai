export type AvailabilityStatus = 'immediate' | '2-weeks' | '1-month' | 'not-looking';

export interface ExperienceItem {
  _id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface EducationItem {
  _id?: string;
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
}

export interface SeekerProfile {
  _id: string;
  user: string | { _id: string; name: string; email: string; role: string };
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  languages: string[];
  availability?: AvailabilityStatus;
  savedJobs: string[];
  completionPercentage: number;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  skills?: string[];
  languages?: string[];
  availability?: AvailabilityStatus;
  experience?: ExperienceItem[];
  education?: EducationItem[];
}
