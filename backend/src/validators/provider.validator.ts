import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const providerObjectIdSchema = z
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

export const upsertProviderOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Provider name must be at least 2 characters')
      .max(200, 'Provider name cannot exceed 200 characters'),
    specialization: z
      .string()
      .trim()
      .max(200, 'Specialization cannot exceed 200 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    industry: z
      .string()
      .trim()
      .max(100, 'Industry or category cannot exceed 100 characters')
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

export type UpsertProviderOrganizationInput = z.infer<typeof upsertProviderOrganizationSchema>;

const syllabusModuleSchema = z
  .object({
    moduleTitle: z
      .string()
      .trim()
      .min(2, 'Module title must be at least 2 characters')
      .max(150, 'Module title cannot exceed 150 characters'),
    lessons: z
      .array(z.string().trim().min(1, 'Lesson title cannot be empty').max(200))
      .max(30, 'Maximum 30 lessons per module')
      .default([]),
    duration: z.coerce
      .number()
      .min(0, 'Module duration cannot be negative')
      .max(1000, 'Module duration cannot exceed 1000 hours')
      .optional(),
  })
  .strict();

const courseLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
const coursePriceSchema = z.coerce
  .number()
  .min(0, 'Price cannot be negative')
  .max(1000000, 'Price cannot exceed 1,000,000');
const courseCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code');
const courseSkillsSchema = z
  .array(z.string().trim().min(1).max(100))
  .max(25, 'Maximum 25 skills per course');
const courseTagsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(20, 'Maximum 20 tags per course');
const courseSyllabusSchema = z
  .array(syllabusModuleSchema)
  .max(30, 'Maximum 30 syllabus modules');

const courseBaseFields = {
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
  category: z
    .string()
    .trim()
    .max(100, 'Category cannot exceed 100 characters')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  level: courseLevelSchema,
  deliveryMode: z
    .enum(['self-paced', 'live-cohort', 'hybrid'])
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  duration: z
    .union([
      z.coerce
        .number()
        .min(0, 'Duration cannot be negative')
        .max(10000, 'Duration cannot exceed 10,000 hours'),
      z.literal(''),
      z.null(),
    ])
    .optional()
    .transform((val) => (val === '' || val === null ? undefined : val)),
  price: coursePriceSchema,
  currency: courseCurrencySchema,
  certificationOffered: z.boolean(),
  skills: courseSkillsSchema,
  tags: courseTagsSchema,
  thumbnailUrl: optionalHttpUrlSchema,
  externalUrl: optionalHttpUrlSchema,
  syllabus: courseSyllabusSchema,
};

export const createCourseSchema = z
  .object({
    ...courseBaseFields,
    level: courseLevelSchema.default('beginner'),
    price: coursePriceSchema.default(0),
    currency: courseCurrencySchema.default('USD'),
    certificationOffered: z.boolean().default(false),
    skills: courseSkillsSchema.default([]),
    tags: courseTagsSchema.default([]),
    syllabus: courseSyllabusSchema.default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z
  .object({
    ...courseBaseFields,
    status: z.enum(['draft', 'published', 'archived']),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one course field is required to update',
  });

export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const updateCourseStatusSchema = z
  .object({
    status: z.enum(['draft', 'published', 'archived']),
  })
  .strict();

export type UpdateCourseStatusInput = z.infer<typeof updateCourseStatusSchema>;

export const enrollCourseSchema = z
  .object({
    type: z.enum(['enrollment', 'enquiry']).default('enrollment'),
    learnerMessage: z
      .string()
      .trim()
      .max(2000, 'Message cannot exceed 2000 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
  })
  .strict();

export type EnrollCourseInput = z.infer<typeof enrollCourseSchema>;

export const updateEngagementSchema = z
  .object({
    status: z.enum(['pending', 'enrolled', 'active', 'completed', 'declined']).optional(),
    progress: z.coerce
      .number()
      .min(0, 'Progress cannot be negative')
      .max(100, 'Progress cannot exceed 100')
      .optional(),
    providerNote: z
      .string()
      .trim()
      .max(1000, 'Internal note cannot exceed 1000 characters')
      .optional(),
    note: z
      .string()
      .trim()
      .max(1000, 'Status history note cannot exceed 1000 characters')
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.status !== undefined ||
      data.progress !== undefined ||
      data.providerNote !== undefined ||
      data.note !== undefined,
    {
      message: 'At least one field (status, progress, or note) is required to update',
    }
  );

export type UpdateEngagementInput = z.infer<typeof updateEngagementSchema>;

export const providerCoursesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).optional(),
  category: z.string().trim().max(100).optional(),
  sort: z
    .enum(['newest', 'oldest', 'enrollments_desc', 'price_asc', 'price_desc'])
    .default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const publicCoursesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  category: z.string().trim().max(100).optional(),
  deliveryMode: z.enum(['self-paced', 'live-cohort', 'hybrid']).optional(),
  skill: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'popular', 'rating', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const providerEngagementsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  courseId: z
    .string()
    .trim()
    .refine((val) => val === '' || OBJECT_ID_REGEX.test(val), {
      message: 'Invalid course identifier format',
    })
    .optional(),
  status: z
    .enum(['all', 'pending', 'enrolled', 'active', 'completed', 'declined', 'withdrawn'])
    .default('all'),
  type: z.enum(['all', 'enrollment', 'enquiry']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const idParamSchema = z.object({
  id: providerObjectIdSchema,
});

const engagementIdParamSchema = z.object({
  engagementId: providerObjectIdSchema,
});

export const validateUpsertProviderOrganization = validateRequest(
  { body: upsertProviderOrganizationSchema },
  'Provider organization profile validation failed'
);

export const validateCreateCourse = validateRequest(
  { body: createCourseSchema },
  'Course validation failed'
);

export const validateUpdateCourse = validateRequest(
  { params: idParamSchema, body: updateCourseSchema },
  'Course update validation failed'
);

export const validateUpdateCourseStatus = validateRequest(
  { params: idParamSchema, body: updateCourseStatusSchema },
  'Course status validation failed'
);

export const validateEnrollCourse = validateRequest(
  { params: idParamSchema, body: enrollCourseSchema },
  'Course enrollment validation failed'
);

export const validateUpdateEngagement = validateRequest(
  { params: engagementIdParamSchema, body: updateEngagementSchema },
  'Engagement update validation failed'
);

export const validateProviderCoursesQuery = validateRequest(
  { query: providerCoursesQuerySchema },
  'Course query validation failed'
);

export const validatePublicCoursesQuery = validateRequest(
  { query: publicCoursesQuerySchema },
  'Public course query validation failed'
);

export const validateProviderEngagementsQuery = validateRequest(
  { query: providerEngagementsQuerySchema },
  'Engagement query validation failed'
);

export const validateCourseIdParam = validateRequest(
  { params: idParamSchema },
  'Invalid course identifier'
);

export const validateEngagementIdParam = validateRequest(
  { params: engagementIdParamSchema },
  'Invalid engagement identifier'
);
