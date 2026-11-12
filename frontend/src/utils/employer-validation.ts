import { z } from 'zod';
import type {
  EmployerJobPayload,
  OrganizationSize,
  UpsertOrganizationPayload,
} from '@/types/employer.types';
import type { ExperienceLevel, JobLocationType, JobType } from '@/types/job.types';

export const ORGANIZATION_SIZES: OrganizationSize[] = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
];

export const JOB_LOCATION_TYPES: Array<{ value: JobLocationType; label: string }> = [
  { value: 'on-site', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const JOB_TYPES: Array<{ value: JobType; label: string }> = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

export const EXPERIENCE_LEVELS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
  { value: 'executive', label: 'Executive' },
];

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR', 'AED', 'SGD'];

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalHttpUrlField = z
  .string()
  .trim()
  .max(500, 'URL cannot exceed 500 characters')
  .refine((val) => val === '' || isHttpUrl(val), {
    message: 'Must be a valid http:// or https:// URL',
  });

const optionalEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, 'Email cannot exceed 200 characters')
  .refine((val) => val === '' || z.string().email().safeParse(val).success, {
    message: 'Must be a valid email address',
  });

const currentYear = new Date().getFullYear();

export const organizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(200, 'Organization name cannot exceed 200 characters'),
  industry: z.string().trim().max(100, 'Industry cannot exceed 100 characters').default(''),
  size: z.enum(['', '1-10', '11-50', '51-200', '201-500', '500+']).default(''),
  founded: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (val === '') return true;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1800 && num <= currentYear;
      },
      { message: `Founded year must be an integer between 1800 and ${currentYear}` }
    )
    .default(''),
  location: z.string().trim().max(200, 'Location cannot exceed 200 characters').default(''),
  description: z
    .string()
    .trim()
    .max(3000, 'Description cannot exceed 3000 characters')
    .default(''),
  logoUrl: optionalHttpUrlField.default(''),
  websiteUrl: optionalHttpUrlField.default(''),
  contactEmail: optionalEmailField.default(''),
  contactPhone: z
    .string()
    .trim()
    .max(30, 'Contact phone cannot exceed 30 characters')
    .default(''),
  socialLinks: z.object({
    linkedin: optionalHttpUrlField.default(''),
    twitter: optionalHttpUrlField.default(''),
    facebook: optionalHttpUrlField.default(''),
    github: optionalHttpUrlField.default(''),
  }),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function organizationValuesToPayload(
  values: OrganizationFormValues
): UpsertOrganizationPayload {
  const foundedNum = values.founded.trim() ? Number(values.founded.trim()) : undefined;
  return {
    name: values.name.trim(),
    industry: values.industry.trim(),
    size: values.size,
    founded: foundedNum ?? '',
    location: values.location.trim(),
    description: values.description.trim(),
    logoUrl: values.logoUrl.trim(),
    websiteUrl: values.websiteUrl.trim(),
    contactEmail: values.contactEmail.trim(),
    contactPhone: values.contactPhone.trim(),
    socialLinks: {
      linkedin: values.socialLinks.linkedin.trim(),
      twitter: values.socialLinks.twitter.trim(),
      facebook: values.socialLinks.facebook.trim(),
      github: values.socialLinks.github.trim(),
    },
  };
}

export interface JobFormInputState {
  title: string;
  description: string;
  responsibilities: string[];
  qualifications: string[];
  skills: string[];
  location: string;
  locationType: JobLocationType;
  type: JobType;
  experienceLevel: ExperienceLevel;
  openings: string;
  includeSalary: boolean;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryIsPublic: boolean;
  applicationDeadline: string;
  status: 'draft' | 'active' | 'closed';
}

export function isDeadlineBeforeTodayUtc(dateStr: string): boolean {
  if (!dateStr.trim()) return false;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return parsed.getTime() < todayUtcStart;
}

export const jobFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Job title must be at least 3 characters')
      .max(200, 'Job title cannot exceed 200 characters'),
    description: z
      .string()
      .trim()
      .min(20, 'Job description must be at least 20 characters')
      .max(10000, 'Job description cannot exceed 10000 characters'),
    responsibilities: z
      .array(z.string().trim().min(1, 'Responsibility cannot be empty').max(500))
      .max(30, 'Maximum 30 responsibilities allowed'),
    qualifications: z
      .array(z.string().trim().min(1, 'Qualification cannot be empty').max(500))
      .max(30, 'Maximum 30 qualifications allowed'),
    skills: z
      .array(z.string().trim().min(1, 'Skill cannot be empty').max(100))
      .max(30, 'Maximum 30 skills allowed'),
    location: z.string().trim().max(200, 'Location cannot exceed 200 characters'),
    locationType: z.enum(['on-site', 'remote', 'hybrid']),
    type: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
    openings: z
      .string()
      .trim()
      .refine(
        (val) => {
          const n = Number(val);
          return Number.isInteger(n) && n >= 1 && n <= 1000;
        },
        { message: 'Number of openings must be a whole number between 1 and 1000' }
      ),
    includeSalary: z.boolean(),
    salaryMin: z.string().trim(),
    salaryMax: z.string().trim(),
    salaryCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => val.length === 3, {
        message: 'Currency must be a 3-letter code',
      }),
    salaryIsPublic: z.boolean(),
    applicationDeadline: z.string().trim(),
    status: z.enum(['draft', 'active', 'closed']),
  })
  .superRefine((data, ctx) => {
    if (data.includeSalary) {
      const hasMin = data.salaryMin !== '';
      const hasMax = data.salaryMax !== '';
      const minVal = hasMin ? Number(data.salaryMin) : undefined;
      const maxVal = hasMax ? Number(data.salaryMax) : undefined;

      if (hasMin && (Number.isNaN(minVal) || (minVal ?? 0) < 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['salaryMin'],
          message: 'Minimum salary must be 0 or greater',
        });
      }
      if (hasMax && (Number.isNaN(maxVal) || (maxVal ?? 0) < 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['salaryMax'],
          message: 'Maximum salary must be 0 or greater',
        });
      }
      if (
        minVal !== undefined &&
        maxVal !== undefined &&
        !Number.isNaN(minVal) &&
        !Number.isNaN(maxVal) &&
        maxVal < minVal
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['salaryMax'],
          message: 'Maximum salary must be greater than or equal to minimum salary',
        });
      }
    }

    if (data.applicationDeadline !== '') {
      const parsed = new Date(data.applicationDeadline);
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: 'custom',
          path: ['applicationDeadline'],
          message: 'Please provide a valid date',
        });
      } else if (data.status === 'active' && isDeadlineBeforeTodayUtc(data.applicationDeadline)) {
        ctx.addIssue({
          code: 'custom',
          path: ['applicationDeadline'],
          message: 'Application deadline must be today or in the future for published jobs',
        });
      }
    }
  });

export function jobValuesToPayload(
  values: JobFormInputState,
  targetStatus?: 'draft' | 'active' | 'closed'
): EmployerJobPayload {
  const minNum = values.salaryMin.trim() ? Number(values.salaryMin.trim()) : undefined;
  const maxNum = values.salaryMax.trim() ? Number(values.salaryMax.trim()) : undefined;

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    responsibilities: values.responsibilities.map((item) => item.trim()).filter(Boolean),
    qualifications: values.qualifications.map((item) => item.trim()).filter(Boolean),
    skills: values.skills.map((item) => item.trim()).filter(Boolean),
    location: values.location.trim() || undefined,
    locationType: values.locationType,
    type: values.type,
    experienceLevel: values.experienceLevel,
    openings: Number(values.openings) || 1,
    salary: values.includeSalary
      ? {
          min: minNum,
          max: maxNum,
          currency: values.salaryCurrency.trim().toUpperCase() || 'USD',
          isPublic: values.salaryIsPublic,
        }
      : undefined,
    applicationDeadline: values.applicationDeadline.trim() || undefined,
    status: targetStatus ?? values.status,
  };
}

export const applicationStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected']),
  employerNote: z.string().trim().max(1000, 'Note cannot exceed 1000 characters').optional(),
});

export const applicationNoteSchema = z.object({
  employerNote: z.string().trim().max(1000, 'Note cannot exceed 1000 characters'),
});

export function extractZodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'form';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
