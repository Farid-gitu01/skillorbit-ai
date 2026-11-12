import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.model.js';
import type { ICourseEnrollment } from '../models/Course.model.js';
import type { IOrganization, OrganizationSize, ISocialLinks } from '../models/Organization.model.js';
import type { IProfile } from '../models/Profile.model.js';
import { escapeRegex, resolveSkillIds, type OrganizationCompletionResult } from './employer.util.js';

export { escapeRegex, resolveSkillIds };

export interface ProviderCompletionInput {
  name?: string;
  specialization?: string;
  industry?: string;
  size?: OrganizationSize | string;
  location?: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: ISocialLinks;
}

export interface SafeLearnerProfile {
  headline?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  availability?: string;
  skills: string[];
  languages: string[];
  experience: IProfile['experience'];
  education: IProfile['education'];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface SafeLearnerSummary {
  _id: string;
  name: string;
  profile: SafeLearnerProfile;
}

export function calculateProviderCompletion(
  org: ProviderCompletionInput | IOrganization | null
): OrganizationCompletionResult {
  let score = 0;
  const missingFields: string[] = [];

  if (org?.name && org.name.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Provider / Business Name');
  }

  if (org?.specialization && org.specialization.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Specialization');
  }

  if (org?.industry && org.industry.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Industry / Category');
  }

  if (org?.location && org.location.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Location');
  }

  if (org?.description && org.description.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Description & Overview');
  }

  if (org?.size && org.size.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Organization Size');
  }

  if (org?.websiteUrl && org.websiteUrl.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Website URL');
  }

  if (org?.logoUrl && org.logoUrl.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Logo Image');
  }

  const hasContact = Boolean(
    (org?.contactEmail && org.contactEmail.trim().length > 0) ||
      (org?.contactPhone && org.contactPhone.trim().length > 0)
  );
  if (hasContact) {
    score += 5;
  } else {
    missingFields.push('Contact Information');
  }

  const hasSocial = Boolean(
    org?.socialLinks &&
      (org.socialLinks.linkedin?.trim() ||
        org.socialLinks.twitter?.trim() ||
        org.socialLinks.facebook?.trim() ||
        org.socialLinks.github?.trim())
  );
  if (hasSocial) {
    score += 5;
  } else {
    missingFields.push('Social Links');
  }

  return { percentage: Math.min(score, 100), missingFields };
}

/**
 * Counts active confirmed enrollments for caching into Course.enrollmentCount.
 */
export function computeActiveEnrollmentCount(enrollments: ICourseEnrollment[]): number {
  return enrollments.filter(
    (entry) =>
      entry.type === 'enrollment' &&
      (entry.status === 'enrolled' || entry.status === 'active' || entry.status === 'completed')
  ).length;
}

export interface LearnerProfileInput {
  headline?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  availability?: string;
  skills?: string[];
  languages?: string[];
  experience?: SafeLearnerProfile['experience'];
  education?: SafeLearnerProfile['education'];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

/**
 * Projects strictly non-private learner profile fields for Provider views.
 * Private fields (email, phone, credentials, private resumes) are excluded intentionally.
 */
export function buildSafeLearnerSummary(
  learnerId: string,
  user: { name?: string } | undefined,
  profile: LearnerProfileInput | undefined
): SafeLearnerSummary {
  return {
    _id: learnerId,
    name: user?.name ?? 'SkillOrbit Learner',
    profile: {
      headline: profile?.headline,
      bio: profile?.bio,
      location: profile?.location,
      avatarUrl: profile?.avatarUrl,
      availability: profile?.availability,
      skills: profile?.skills ?? [],
      languages: profile?.languages ?? [],
      experience: profile?.experience ?? [],
      education: profile?.education ?? [],
      linkedinUrl: profile?.linkedinUrl,
      githubUrl: profile?.githubUrl,
      portfolioUrl: profile?.portfolioUrl,
    },
  };
}

export async function recordProviderAudit(params: {
  actorId: string;
  action: string;
  resource: 'Organization' | 'Course' | 'Enrollment';
  resourceId: mongoose.Types.ObjectId | string;
  changes?: Record<string, unknown>;
  statusCode?: number;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actorId,
      actorRole: 'provider',
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      changes: params.changes,
      statusCode: params.statusCode,
    });
  } catch {
    // Audit logging must never disrupt primary provider workflows
  }
}
