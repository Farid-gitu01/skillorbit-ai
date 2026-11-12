import type { ApplicationStatus } from '@/types/application.types';
import type { BadgeVariant } from '@/components/ui';
import type { JobStatus, Salary } from '@/types/job.types';

export function formatSalary(salary?: Salary): string {
  if (!salary || !salary.isPublic) {
    return 'Competitive Salary';
  }
  const currency = salary.currency ?? 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

  if (salary.min && salary.max) {
    return `${formatter.format(salary.min)} - ${formatter.format(salary.max)}`;
  }
  if (salary.min) {
    return `From ${formatter.format(salary.min)}`;
  }
  if (salary.max) {
    return `Up to ${formatter.format(salary.max)}`;
  }
  return 'Competitive Salary';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getApplicationStatusBadge(status: ApplicationStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending Review', variant: 'warning' };
    case 'reviewed':
      return { label: 'Reviewed', variant: 'info' };
    case 'shortlisted':
      return { label: 'Shortlisted', variant: 'purple' };
    case 'accepted':
      return { label: 'Accepted', variant: 'success' };
    case 'rejected':
      return { label: 'Not Selected', variant: 'danger' };
    case 'withdrawn':
      return { label: 'Withdrawn', variant: 'default' };
    default:
      return { label: status, variant: 'default' };
  }
}

export function getJobStatusBadge(status: JobStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'active':
      return { label: 'Published', variant: 'success' };
    case 'draft':
      return { label: 'Draft', variant: 'warning' };
    case 'closed':
      return { label: 'Closed', variant: 'default' };
    case 'expired':
      return { label: 'Expired', variant: 'danger' };
    default:
      return { label: status, variant: 'default' };
  }
}
