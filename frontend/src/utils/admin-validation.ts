import { z } from 'zod';
import type {
  ContentModerationStatus,
  OrganizationVerificationStatus,
} from '../types/admin.types.ts';
import type { UserRole } from '../types/user.types.ts';

export const adminStatusDecisionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export const adminSuspendReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Please provide a reason (at least 3 characters)')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const adminVerificationDecisionSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  reason: z
    .string()
    .trim()
    .min(3, 'A verification decision reason (min 3 characters) is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const adminJobModerationSchema = z.object({
  moderationStatus: z.enum(['approved', 'flagged', 'rejected']),
  status: z.enum(['active', 'closed', 'draft']).optional(),
  reason: z
    .string()
    .trim()
    .min(3, 'A moderation reason (min 3 characters) is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const adminCourseModerationSchema = z.object({
  moderationStatus: z.enum(['approved', 'flagged', 'rejected']),
  status: z.enum(['published', 'archived', 'draft']).optional(),
  reason: z
    .string()
    .trim()
    .min(3, 'A moderation reason (min 3 characters) is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export type BadgeTone =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';

export function getAccountStatusBadge(isActive: boolean): {
  label: string;
  variant: BadgeTone;
} {
  return isActive
    ? { label: 'Active', variant: 'success' }
    : { label: 'Suspended', variant: 'danger' };
}

export function getVerificationBadge(
  status?: OrganizationVerificationStatus | string
): {
  label: string;
  variant: BadgeTone;
} {
  switch (status) {
    case 'verified':
      return { label: 'Verified', variant: 'success' };
    case 'rejected':
      return { label: 'Rejected', variant: 'danger' };
    default:
      return { label: 'Pending Review', variant: 'warning' };
  }
}

export function getModerationBadge(
  status?: ContentModerationStatus | string
): {
  label: string;
  variant: BadgeTone;
} {
  switch (status) {
    case 'flagged':
      return { label: 'Flagged', variant: 'warning' };
    case 'rejected':
      return { label: 'Rejected', variant: 'danger' };
    default:
      return { label: 'Approved', variant: 'success' };
  }
}

export function getRoleBadge(role: UserRole | 'system' | string): {
  label: string;
  variant: BadgeTone;
} {
  switch (role) {
    case 'admin':
      return { label: 'Admin', variant: 'purple' };
    case 'employer':
      return { label: 'Employer', variant: 'primary' };
    case 'provider':
      return { label: 'Provider', variant: 'info' };
    case 'seeker':
      return { label: 'Job Seeker', variant: 'default' };
    default:
      return { label: 'System', variant: 'default' };
  }
}

export function validateUserStatusReason(isActive: boolean, reason: string): string | null {
  const trimmed = reason.trim();
  if (!isActive && trimmed.length < 3) {
    return 'A suspension reason of at least 3 characters is required';
  }
  if (isActive && trimmed.length > 0 && trimmed.length < 3) {
    return 'If provided, reinstatement note must be at least 3 characters';
  }
  if (trimmed.length > 500) {
    return 'Reason cannot exceed 500 characters';
  }
  return null;
}

export function validateModerationPayload(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return 'A decision reason of at least 3 characters is required';
  }
  if (trimmed.length > 500) {
    return 'Reason cannot exceed 500 characters';
  }
  return null;
}

export function formatAdminTimestamp(value?: string): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
