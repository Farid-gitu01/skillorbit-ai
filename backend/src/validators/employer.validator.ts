import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(OBJECT_ID_REGEX, 'Invalid identifier format');

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(500, 'URL cannot exceed 500 characters')
  .refine((val) => val === '' || isHttpUrl(val), {
    message: 'Must be a valid http:// or https:// URL',
  })
  .optional()
  .transform((val) => (val === '' ? undefined : val));

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, 'Email cannot exceed 200 characters')
  .refine((val) => val === '' || z.string().email().safeParse(val).success, {
    message: 'Must be a valid email address',
  })
  .optional()
  .transform((val) => (val === '' ? undefined : val));

const currentYear = new Date().getFullYear();

export const upsertOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters')
      .max(200, 'Organization name cannot exceed 200 characters'),
    industry: z
      .string()
      .trim()
      .max(100, 'Industry cannot exceed 100 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    size: z
      .enum(['1-10', '11-50', '51-200', '201-500', '500+'])
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),
    founded: z
      .union([
        z.coerce
          .number()
          .int('Founded year must be a whole number')
          .min(1800, 'Founded year must be 1800 or later')
          .max(currentYear, `Founded year cannot exceed ${currentYear}`),
        z.literal(''),
        z.null(),
      ])
      .optional()
      .transform((val) => (val === '' || val === null ? undefined : val)),
    location: z
      .string()
      .trim()
      .max(200, 'Location cannot exceed 200 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    description: z
      .string()
      .trim()
      .max(3000, 'Description cannot exceed 3000 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    logoUrl: optionalHttpUrlSchema,
    websiteUrl: optionalHttpUrlSchema,
    contactEmail: optionalEmailSchema,
    contactPhone: z
      .string()
      .trim()
      .max(30, 'Contact phone cannot exceed 30 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    socialLinks: z
      .object({
        linkedin: optionalHttpUrlSchema,
        twitter: optionalHttpUrlSchema,
        facebook: optionalHttpUrlSchema,
        github: optionalHttpUrlSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export type UpsertOrganizationInput = z.infer<typeof upsertOrganizationSchema>;

const salarySchema = z
  .object({
    min: z
      .union([z.coerce.number().min(0, 'Minimum salary cannot be negative'), z.literal(''), z.null()])
      .optional()
      .transform((val) => (val === '' || val === null ? undefined : val)),
    max: z
      .union([z.coerce.number().min(0, 'Maximum salary cannot be negative'), z.literal(''), z.null()])
      .optional()
      .transform((val) => (val === '' || val === null ? undefined : val)),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Currency must be a 3-letter code')
      .max(3, 'Currency must be a 3-letter code')
      .default('USD'),
    isPublic: z.boolean().default(false),
  })
  .strict()
  .refine(
    (data) =>
      data.min === undefined || data.max === undefined || data.max >= data.min,
    {
      message: 'Maximum salary must be greater than or equal to minimum salary',
      path: ['max'],
    }
  );

const optionalDeadlineSchema = z
  .union([z.coerce.date(), z.literal(''), z.null()])
  .optional()
  .transform((val) => (val === '' || val === null ? undefined : val));

const baseJobFields = {
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
    .max(30, 'Maximum 30 responsibilities allowed')
    .default([]),
  qualifications: z
    .array(z.string().trim().min(1, 'Qualification cannot be empty').max(500))
    .max(30, 'Maximum 30 qualifications allowed')
    .default([]),
  skills: z
    .array(z.string().trim().min(1, 'Skill cannot be empty').max(100))
    .max(30, 'Maximum 30 skills allowed')
    .default([]),
  location: z
    .string()
    .trim()
    .max(200, 'Location cannot exceed 200 characters')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  locationType: z.enum(['on-site', 'remote', 'hybrid']),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
  openings: z.coerce
    .number()
    .int('Number of openings must be a whole number')
    .min(1, 'Number of openings must be at least 1')
    .max(1000, 'Openings cannot exceed 1000')
    .default(1),
  salary: salarySchema.optional(),
  applicationDeadline: optionalDeadlineSchema,
};

export const createJobSchema = z
  .object({
    ...baseJobFields,
    status: z.enum(['draft', 'active']).default('draft'),
  })
  .strict();

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z
  .object({
    ...baseJobFields,
    status: z.enum(['draft', 'active', 'closed']).optional(),
  })
  .strict();

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const updateJobStatusSchema = z
  .object({
    status: z.enum(['draft', 'active', 'closed']),
  })
  .strict();

export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>;

export const employerJobsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['all', 'draft', 'active', 'closed', 'expired']).default('all'),
  locationType: z.enum(['on-site', 'remote', 'hybrid']).optional(),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'oldest', 'deadline', 'applicants']).default('newest'),
});

export const employerApplicationsQuerySchema = z.object({
  jobId: objectIdSchema.optional(),
  status: z
    .enum(['all', 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'])
    .default('all'),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'oldest', 'match_desc']).default('newest'),
});

export const updateApplicationStatusSchema = z
  .object({
    status: z.enum(['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected']),
    employerNote: z
      .string()
      .trim()
      .max(1000, 'Note cannot exceed 1000 characters')
      .optional(),
  })
  .strict();

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

export const updateApplicationNoteSchema = z
  .object({
    employerNote: z.string().trim().max(1000, 'Note cannot exceed 1000 characters'),
  })
  .strict();

export type UpdateApplicationNoteInput = z.infer<typeof updateApplicationNoteSchema>;

export const employerCandidatesQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum(['all', 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'])
    .default('all'),
  jobId: objectIdSchema.optional(),
  shortlistedOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const validateIdParam = validateRequest({
  params: z.object({ id: objectIdSchema }),
});

export const validateCandidateIdParam = validateRequest({
  params: z.object({ candidateId: objectIdSchema }),
});

export const validateUpsertOrganization = validateRequest(
  { body: upsertOrganizationSchema },
  'Organization validation failed'
);

export const validateCreateJob = validateRequest(
  { body: createJobSchema },
  'Job validation failed'
);

export const validateUpdateJob = validateRequest(
  { params: z.object({ id: objectIdSchema }), body: updateJobSchema },
  'Job validation failed'
);

export const validateUpdateJobStatus = validateRequest(
  { params: z.object({ id: objectIdSchema }), body: updateJobStatusSchema },
  'Job status validation failed'
);

export const validateEmployerJobsQuery = validateRequest({
  query: employerJobsQuerySchema,
});

export const validateEmployerApplicationsQuery = validateRequest({
  query: employerApplicationsQuerySchema,
});

export const validateUpdateApplicationStatus = validateRequest(
  { params: z.object({ id: objectIdSchema }), body: updateApplicationStatusSchema },
  'Application status validation failed'
);

export const validateUpdateApplicationNote = validateRequest(
  { params: z.object({ id: objectIdSchema }), body: updateApplicationNoteSchema },
  'Application note validation failed'
);

export const validateEmployerCandidatesQuery = validateRequest({
  query: employerCandidatesQuerySchema,
});
