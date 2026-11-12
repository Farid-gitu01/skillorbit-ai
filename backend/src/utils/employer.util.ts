import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.model.js';
import type { IOrganization, OrganizationSize, ISocialLinks } from '../models/Organization.model.js';
import { Skill } from '../models/Skill.model.js';

export interface OrganizationCompletionResult {
  percentage: number;
  missingFields: string[];
}

export interface OrganizationCompletionInput {
  name?: string;
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

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function calculateOrganizationCompletion(
  org: OrganizationCompletionInput | IOrganization | null
): OrganizationCompletionResult {
  let score = 0;
  const missingFields: string[] = [];

  if (org?.name && org.name.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Organization Name');
  }

  if (org?.industry && org.industry.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Industry');
  }

  if (org?.size && org.size.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Company Size');
  }

  if (org?.location && org.location.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Headquarters Location');
  }

  if (org?.description && org.description.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Company Description');
  }

  if (org?.websiteUrl && org.websiteUrl.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Website URL');
  }

  if (org?.logoUrl && org.logoUrl.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Company Logo');
  }

  const hasContact = Boolean(
    (org?.contactEmail && org.contactEmail.trim().length > 0) ||
      (org?.contactPhone && org.contactPhone.trim().length > 0)
  );
  if (hasContact) {
    score += 10;
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
    missingFields.push('Social / Professional Links');
  }

  return { percentage: Math.min(score, 100), missingFields };
}

function toSkillSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves an array of skill names or 24-hex ObjectIds into unique Skill ObjectIds.
 * Creates Skill records when a valid new skill name does not exist yet.
 */
export async function resolveSkillIds(skillsInput: string[]): Promise<mongoose.Types.ObjectId[]> {
  const uniqueIds = new Map<string, mongoose.Types.ObjectId>();

  for (const raw of skillsInput) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (mongoose.Types.ObjectId.isValid(trimmed) && /^[0-9a-fA-F]{24}$/.test(trimmed)) {
      const existingById = await Skill.findById(trimmed).select('_id').lean();
      if (existingById) {
        uniqueIds.set(String(existingById._id), existingById._id);
        continue;
      }
    }

    const slug = toSkillSlug(trimmed) || trimmed.toLowerCase();
    const existing = await Skill.findOne({
      $or: [{ slug }, { name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }],
    })
      .select('_id')
      .lean();

    if (existing) {
      uniqueIds.set(String(existing._id), existing._id);
      continue;
    }

    try {
      const created = await Skill.create({
        name: trimmed.slice(0, 100),
        slug,
        category: 'General',
        isActive: true,
      });
      uniqueIds.set(String(created._id), created._id as mongoose.Types.ObjectId);
    } catch {
      const retry = await Skill.findOne({
        $or: [{ slug }, { name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }],
      })
        .select('_id')
        .lean();
      if (retry) {
        uniqueIds.set(String(retry._id), retry._id);
      }
    }
  }

  return Array.from(uniqueIds.values());
}

export async function recordEmployerAudit(params: {
  actorId: string;
  action: string;
  resource: 'Organization' | 'Job' | 'Application';
  resourceId: mongoose.Types.ObjectId | string;
  changes?: Record<string, unknown>;
  statusCode?: number;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actorId,
      actorRole: 'employer',
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      changes: params.changes,
      statusCode: params.statusCode,
    });
  } catch {
    // Audit logging must not disrupt primary employer operations
  }
}
