import { z } from 'zod';
import type { BadgeVariant } from '@/components/ui';
import type { OrganizationSize } from '@/types/employer.types';
import type {
  Course,
  CourseDeliveryMode,
  CourseLevel,
  CoursePayload,
  CourseStatus,
  EngagementStatus,
  SyllabusModule,
  UpsertProviderOrganizationPayload,
} from '@/types/provider.types';
import {
  CURRENCY_OPTIONS,
  extractZodFieldErrors,
  isHttpUrl,
  ORGANIZATION_SIZES,
} from './employer-validation.ts';

export { CURRENCY_OPTIONS, extractZodFieldErrors, isHttpUrl, ORGANIZATION_SIZES };

export const COURSE_LEVELS: Array<{ value: CourseLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const COURSE_DELIVERY_MODES: Array<{ value: CourseDeliveryMode; label: string }> = [
  { value: 'self-paced', label: 'Self-paced' },
  { value: 'live-cohort', label: 'Live Cohort' },
  { value: 'hybrid', label: 'Hybrid' },
];

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

export const providerOrganizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Provider name must be at least 2 characters')
    .max(200, 'Provider name cannot exceed 200 characters'),
  specialization: z
    .string()
    .trim()
    .max(200, 'Specialization cannot exceed 200 characters'),
  industry: z.string().trim().max(100, 'Industry / category cannot exceed 100 characters'),
  size: z.enum(['', '1-10', '11-50', '51-200', '201-500', '500+']),
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
    ),
  location: z.string().trim().max(200, 'Location cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .max(3000, 'Description cannot exceed 3000 characters'),
  logoUrl: optionalHttpUrlField,
  websiteUrl: optionalHttpUrlField,
  contactEmail: optionalEmailField,
  contactPhone: z
    .string()
    .trim()
    .max(30, 'Contact phone cannot exceed 30 characters'),
  socialLinks: z.object({
    linkedin: optionalHttpUrlField,
    twitter: optionalHttpUrlField,
    facebook: optionalHttpUrlField,
    github: optionalHttpUrlField,
  }),
});

export type ProviderOrganizationFormValues = z.infer<typeof providerOrganizationFormSchema>;

export function providerOrganizationValuesToPayload(
  values: ProviderOrganizationFormValues
): UpsertProviderOrganizationPayload {
  const foundedNum = values.founded.trim() ? Number(values.founded.trim()) : undefined;
  return {
    name: values.name.trim(),
    specialization: values.specialization.trim(),
    industry: values.industry.trim(),
    size: values.size as OrganizationSize | '',
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

export interface SyllabusModuleFormRow {
  moduleTitle: string;
  lessonsText: string;
  duration: string;
}

export interface CourseFormInputState {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  deliveryMode: '' | CourseDeliveryMode;
  duration: string;
  price: string;
  currency: string;
  certificationOffered: boolean;
  skills: string[];
  tags: string[];
  thumbnailUrl: string;
  externalUrl: string;
  syllabus: SyllabusModuleFormRow[];
  status: CourseStatus;
}

export const courseFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Course title must be at least 3 characters')
      .max(200, 'Course title cannot exceed 200 characters'),
    description: z
      .string()
      .trim()
      .min(20, 'Course description must be at least 20 characters')
      .max(5000, 'Course description cannot exceed 5000 characters'),
    category: z.string().trim().max(100, 'Category cannot exceed 100 characters'),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    deliveryMode: z.enum(['', 'self-paced', 'live-cohort', 'hybrid']),
    duration: z.string().trim(),
    price: z.string().trim(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: 'Currency must be a 3-letter ISO code',
      }),
    certificationOffered: z.boolean(),
    skills: z.array(z.string().trim().min(1).max(100)).max(25, 'Maximum 25 skills allowed'),
    tags: z.array(z.string().trim().min(1).max(60)).max(20, 'Maximum 20 tags allowed'),
    thumbnailUrl: optionalHttpUrlField,
    externalUrl: optionalHttpUrlField,
    syllabus: z
      .array(
        z.object({
          moduleTitle: z.string().trim(),
          lessonsText: z.string().trim(),
          duration: z.string().trim(),
        })
      )
      .max(30, 'Maximum 30 syllabus modules allowed'),
    status: z.enum(['draft', 'published', 'archived']),
  })
  .superRefine((data, ctx) => {
    if (data.duration !== '') {
      const dur = Number(data.duration);
      if (Number.isNaN(dur) || dur < 0 || dur > 10000) {
        ctx.addIssue({
          code: 'custom',
          path: ['duration'],
          message: 'Duration must be a number between 0 and 10,000 hours',
        });
      }
    }

    const priceNum = data.price === '' ? 0 : Number(data.price);
    if (Number.isNaN(priceNum) || priceNum < 0 || priceNum > 1000000) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: 'Price must be 0 or greater (up to 1,000,000)',
      });
    }

    data.syllabus.forEach((mod, idx) => {
      if (mod.moduleTitle.length < 2 || mod.moduleTitle.length > 150) {
        ctx.addIssue({
          code: 'custom',
          path: ['syllabus', idx, 'moduleTitle'],
          message: `Module #${idx + 1} title must be between 2 and 150 characters`,
        });
      }
      if (mod.duration !== '') {
        const modDur = Number(mod.duration);
        if (Number.isNaN(modDur) || modDur < 0 || modDur > 1000) {
          ctx.addIssue({
            code: 'custom',
            path: ['syllabus', idx, 'duration'],
            message: `Module #${idx + 1} duration must be between 0 and 1000 hours`,
          });
        }
      }
    });
  });

export function courseFormToPayload(
  values: CourseFormInputState,
  targetStatus?: CourseStatus
): CoursePayload {
  const durationVal = values.duration.trim() !== '' ? Number(values.duration.trim()) : undefined;
  const priceVal = values.price.trim() !== '' ? Number(values.price.trim()) : 0;

  const syllabus: SyllabusModule[] = values.syllabus
    .filter((mod) => mod.moduleTitle.trim().length > 0)
    .map((mod) => {
      const lessons = mod.lessonsText
        .split(/\r?\n|,/)
        .map((line) => line.trim())
        .filter(Boolean);
      const modDur = mod.duration.trim() !== '' ? Number(mod.duration.trim()) : undefined;
      return {
        moduleTitle: mod.moduleTitle.trim(),
        lessons,
        duration: modDur,
      };
    });

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category.trim() || undefined,
    level: values.level,
    deliveryMode: values.deliveryMode || undefined,
    duration: durationVal,
    price: Number.isNaN(priceVal) ? 0 : priceVal,
    currency: values.currency.trim().toUpperCase() || 'USD',
    certificationOffered: values.certificationOffered,
    skills: values.skills.map((s) => s.trim()).filter(Boolean),
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    thumbnailUrl: values.thumbnailUrl.trim() || undefined,
    externalUrl: values.externalUrl.trim() || undefined,
    syllabus,
    status: targetStatus ?? values.status,
  };
}

export function courseToFormState(course: Course): CourseFormInputState {
  const skillNames = (course.skills ?? [])
    .map((item) => (typeof item === 'string' ? item : item.name))
    .filter(Boolean);

  return {
    title: course.title ?? '',
    description: course.description ?? '',
    category: course.category ?? '',
    level: course.level ?? 'beginner',
    deliveryMode: course.deliveryMode ?? '',
    duration: course.duration !== undefined && course.duration !== null ? String(course.duration) : '',
    price: course.price !== undefined && course.price !== null ? String(course.price) : '0',
    currency: course.currency ?? 'USD',
    certificationOffered: Boolean(course.certificationOffered),
    skills: skillNames,
    tags: course.tags ?? [],
    thumbnailUrl: course.thumbnailUrl ?? '',
    externalUrl: course.externalUrl ?? '',
    syllabus: (course.syllabus ?? []).map((mod) => ({
      moduleTitle: mod.moduleTitle,
      lessonsText: (mod.lessons ?? []).join('\n'),
      duration: mod.duration !== undefined && mod.duration !== null ? String(mod.duration) : '',
    })),
    status: course.status ?? 'draft',
  };
}

export const engagementUpdateSchema = z.object({
  status: z.enum(['pending', 'enrolled', 'active', 'completed', 'declined']),
  progress: z.coerce
    .number()
    .min(0, 'Progress must be between 0 and 100')
    .max(100, 'Progress must be between 0 and 100'),
  providerNote: z.string().trim().max(1000, 'Internal note cannot exceed 1000 characters'),
  note: z.string().trim().max(1000, 'Update note cannot exceed 1000 characters').optional(),
});

export function getCourseStatusBadge(status: CourseStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'published':
      return { label: 'Published', variant: 'success' };
    case 'draft':
      return { label: 'Draft', variant: 'warning' };
    case 'archived':
      return { label: 'Archived', variant: 'default' };
    default:
      return { label: status, variant: 'default' };
  }
}

export function getEngagementStatusBadge(status: EngagementStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending Review', variant: 'warning' };
    case 'enrolled':
      return { label: 'Enrolled', variant: 'info' };
    case 'active':
      return { label: 'In Progress', variant: 'primary' };
    case 'completed':
      return { label: 'Completed', variant: 'success' };
    case 'declined':
      return { label: 'Declined', variant: 'danger' };
    case 'withdrawn':
      return { label: 'Withdrawn', variant: 'default' };
    default:
      return { label: status, variant: 'default' };
  }
}

export function formatCoursePrice(price: number, currency = 'USD'): string {
  if (!price || price <= 0) {
    return 'Free';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency.toUpperCase()} ${price}`;
  }
}
