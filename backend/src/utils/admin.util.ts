import mongoose from 'mongoose';
import { AuditLog, type IAuditLog } from '../models/AuditLog.model.js';
import { Notification } from '../models/Notification.model.js';

export type AuditActorRole = IAuditLog['actorRole'];
import type { OrganizationVerificationStatus } from '../models/Organization.model.js';
import type { UserRole } from '../models/user.model.js';
import { escapeRegex } from './employer.util.js';

export { escapeRegex };

export const SAFE_USER_PROJECTION =
  '-password -passwordResetTokenHash -passwordResetExpiresAt -emailVerificationTokenHash -emailVerificationExpiresAt -__v';

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordresettoken',
  'passwordresettokenhash',
  'emailverificationtoken',
  'emailverificationtokenhash',
  'token',
  'secret',
  'jwt',
  'cookie',
]);

export interface SafeAdminUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  suspensionReason?: string;
  suspendedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export function sanitizeAdminUser(rawUser: unknown): SafeAdminUser | null {
  if (!rawUser || typeof rawUser !== 'object') {
    return null;
  }

  const record = rawUser as Record<string, unknown>;
  const idValue = record._id ?? record.id;
  if (!idValue) {
    return null;
  }

  return {
    _id: String(idValue),
    name: typeof record.name === 'string' ? record.name : '',
    email: typeof record.email === 'string' ? record.email : '',
    role: (record.role as UserRole) ?? 'seeker',
    isActive: record.isActive !== false,
    isEmailVerified: Boolean(record.isEmailVerified),
    lastLoginAt: record.lastLoginAt instanceof Date || typeof record.lastLoginAt === 'string'
      ? new Date(record.lastLoginAt)
      : undefined,
    suspensionReason: typeof record.suspensionReason === 'string' ? record.suspensionReason : undefined,
    suspendedAt: record.suspendedAt instanceof Date || typeof record.suspendedAt === 'string'
      ? new Date(record.suspendedAt)
      : undefined,
    createdAt: record.createdAt instanceof Date || typeof record.createdAt === 'string'
      ? new Date(record.createdAt)
      : undefined,
    updatedAt: record.updatedAt instanceof Date || typeof record.updatedAt === 'string'
      ? new Date(record.updatedAt)
      : undefined,
  };
}

export function isProtectedAdminTarget(
  target: { _id?: unknown; role?: string; isDeleted?: boolean },
  actorUserId: string
): { blocked: true; statusCode: number; code: string; message: string } | { blocked: false } {
  if (target.isDeleted) {
    return {
      blocked: true,
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'User account not found or has been deleted',
    };
  }

  if (String(target._id) === String(actorUserId)) {
    return {
      blocked: true,
      statusCode: 403,
      code: 'SELF_MODIFICATION_FORBIDDEN',
      message: 'Administrators cannot suspend or deactivate their own account',
    };
  }

  if (target.role === 'admin') {
    return {
      blocked: true,
      statusCode: 403,
      code: 'PROTECTED_ADMIN_ACCOUNT',
      message: 'Protected administrator accounts cannot be modified through Admin endpoints',
    };
  }

  return { blocked: false };
}

export function resolveVerificationStatus(org: {
  isVerified?: boolean;
  verificationStatus?: string;
} | null | undefined): OrganizationVerificationStatus {
  if (!org) return 'pending';
  if (org.verificationStatus === 'verified' || org.isVerified === true) {
    return 'verified';
  }
  if (org.verificationStatus === 'rejected') {
    return 'rejected';
  }
  return 'pending';
}

export function sanitizeAuditChanges(input?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_AUDIT_KEYS.has(normalizedKey)) {
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !mongoose.isValidObjectId(value)) {
      const nested = sanitizeAuditChanges(value as Record<string, unknown>);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
      }
      continue;
    }

    sanitized[key] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

interface RecordAdminAuditParams {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: mongoose.Types.ObjectId | string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
}

export async function recordAdminAudit({
  actorId,
  action,
  resource,
  resourceId,
  changes,
  ipAddress,
  userAgent,
  statusCode = 200,
}: RecordAdminAuditParams): Promise<void> {
  try {
    if (!mongoose.isValidObjectId(actorId)) {
      return;
    }

    await AuditLog.create({
      actor: new mongoose.Types.ObjectId(actorId),
      actorRole: 'admin' satisfies AuditActorRole,
      action,
      resource,
      resourceId:
        resourceId && mongoose.isValidObjectId(String(resourceId))
          ? new mongoose.Types.ObjectId(String(resourceId))
          : undefined,
      changes: sanitizeAuditChanges(changes),
      ipAddress,
      userAgent,
      statusCode,
    });
  } catch {
    // Audit persistence failure must not break completed administrative mutations
  }
}

interface NotifyByAdminParams {
  recipientId: mongoose.Types.ObjectId | string;
  title: string;
  message: string;
  link?: string;
  relatedId?: mongoose.Types.ObjectId | string;
}

export async function notifyByAdmin({
  recipientId,
  title,
  message,
  link,
  relatedId,
}: NotifyByAdminParams): Promise<void> {
  try {
    if (!mongoose.isValidObjectId(String(recipientId))) {
      return;
    }

    await Notification.create({
      recipient: new mongoose.Types.ObjectId(String(recipientId)),
      type: 'admin_action',
      title,
      message,
      link,
      relatedId:
        relatedId && mongoose.isValidObjectId(String(relatedId))
          ? new mongoose.Types.ObjectId(String(relatedId))
          : undefined,
      read: false,
    });
  } catch {
    // Notification dispatch should not fail primary administrative operations
  }
}

const ADMIN_ACTION_SUMMARIES: Record<
  string,
  { title: string; format: (changes?: Record<string, unknown>) => string }
> = {
  ADMIN_USER_SUSPENDED: {
    title: 'User account suspended',
    format: (changes) =>
      typeof changes?.targetEmail === 'string'
        ? `Suspended ${changes.targetEmail}${typeof changes.reason === 'string' ? ` (${changes.reason})` : ''}`
        : 'Suspended a user account',
  },
  ADMIN_USER_ACTIVATED: {
    title: 'User account reinstated',
    format: (changes) =>
      typeof changes?.targetEmail === 'string'
        ? `Reinstated ${changes.targetEmail}`
        : 'Activated a user account',
  },
  ADMIN_ORGANIZATION_VERIFIED: {
    title: 'Organization verified',
    format: (changes) =>
      typeof changes?.organizationName === 'string'
        ? `Approved verification for ${changes.organizationName}`
        : 'Approved organization verification',
  },
  ADMIN_ORGANIZATION_REJECTED: {
    title: 'Organization verification rejected',
    format: (changes) =>
      typeof changes?.organizationName === 'string'
        ? `Rejected verification for ${changes.organizationName}${typeof changes.reason === 'string' ? ` (${changes.reason})` : ''}`
        : 'Rejected organization verification',
  },
  ADMIN_JOB_MODERATED: {
    title: 'Job posting moderated',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `"${changes.title}" set to ${String(changes.moderationStatus ?? 'updated')}`
        : 'Updated moderation state for a job listing',
  },
  ADMIN_COURSE_MODERATED: {
    title: 'Course offering moderated',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `"${changes.title}" set to ${String(changes.moderationStatus ?? 'updated')}`
        : 'Updated moderation state for a training course',
  },
};

export interface FormattedAuditActivity {
  _id: string;
  action: string;
  actorRole: AuditActorRole;
  resource: string;
  resourceId?: string;
  title: string;
  description: string;
  changes?: Record<string, unknown>;
  statusCode?: number;
  createdAt: Date;
  actor?: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
}

export function formatAdminAuditEntry(rawLog: unknown): FormattedAuditActivity {
  const log = (rawLog ?? {}) as Record<string, unknown>;
  const action = typeof log.action === 'string' ? log.action : 'PLATFORM_EVENT';
  const changes =
    log.changes && typeof log.changes === 'object'
      ? sanitizeAuditChanges(log.changes as Record<string, unknown>)
      : undefined;

  const known = ADMIN_ACTION_SUMMARIES[action];
  const resource = typeof log.resource === 'string' ? log.resource : 'System';

  const rawActor = log.actor;
  let actor: FormattedAuditActivity['actor'] = null;
  if (rawActor && typeof rawActor === 'object' && '_id' in (rawActor as Record<string, unknown>)) {
    const actorRecord = rawActor as Record<string, unknown>;
    actor = {
      _id: String(actorRecord._id),
      name: typeof actorRecord.name === 'string' ? actorRecord.name : 'Platform User',
      email: typeof actorRecord.email === 'string' ? actorRecord.email : '',
      role: (actorRecord.role as UserRole) ?? (log.actorRole as UserRole) ?? 'seeker',
    };
  }

  const title = known?.title ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase());
  const description = known?.format(changes) ?? `${action} on ${resource}`;

  return {
    _id: String(log._id ?? ''),
    action,
    actorRole: (log.actorRole as AuditActorRole) ?? 'system',
    resource,
    resourceId: log.resourceId ? String(log.resourceId) : undefined,
    title,
    description,
    changes,
    statusCode: typeof log.statusCode === 'number' ? log.statusCode : undefined,
    createdAt: log.createdAt instanceof Date || typeof log.createdAt === 'string'
      ? new Date(log.createdAt)
      : new Date(),
    actor,
  };
}
