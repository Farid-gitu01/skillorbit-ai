import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const adminObjectIdSchema = z
  .string()
  .trim()
  .regex(OBJECT_ID_REGEX, 'Invalid identifier format');

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(50).default(12);

const optionalSearchSchema = z
  .string()
  .trim()
  .max(120, 'Search query cannot exceed 120 characters')
  .optional()
  .transform((val) => (val === '' ? undefined : val));

export const adminUsersQuerySchema = z.object({
  q: optionalSearchSchema,
  role: z.enum(['all', 'seeker', 'employer', 'provider', 'admin']).optional().default('all'),
  status: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest'),
  page: pageSchema,
  limit: limitSchema,
});

export const adminPartnersQuerySchema = z.object({
  q: optionalSearchSchema,
  accountStatus: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  verificationStatus: z.enum(['all', 'pending', 'verified', 'rejected']).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest'),
  page: pageSchema,
  limit: limitSchema,
});

export const adminJobsQuerySchema = z.object({
  q: optionalSearchSchema,
  status: z.enum(['all', 'draft', 'active', 'closed', 'expired']).optional().default('all'),
  moderationStatus: z.enum(['all', 'approved', 'flagged', 'rejected']).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'applicants']).optional().default('newest'),
  page: pageSchema,
  limit: limitSchema,
});

export const adminCoursesQuerySchema = z.object({
  q: optionalSearchSchema,
  status: z.enum(['all', 'draft', 'published', 'archived']).optional().default('all'),
  moderationStatus: z.enum(['all', 'approved', 'flagged', 'rejected']).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'enrollments']).optional().default('newest'),
  page: pageSchema,
  limit: limitSchema,
});

export const adminVerificationsQuerySchema = z.object({
  q: optionalSearchSchema,
  type: z.enum(['all', 'employer', 'training-provider']).optional().default('all'),
  status: z.enum(['all', 'pending', 'verified', 'rejected']).optional().default('pending'),
  sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest'),
  page: pageSchema,
  limit: limitSchema,
});

export const adminAuditLogsQuerySchema = z.object({
  q: optionalSearchSchema,
  actorRole: z.enum(['all', 'seeker', 'employer', 'provider', 'admin', 'system']).optional().default('all'),
  resource: optionalSearchSchema,
  action: optionalSearchSchema,
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(500, 'Reason cannot exceed 500 characters')
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.isActive && (!data.reason || data.reason.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A suspension reason of at least 3 characters is required',
      });
    }
    if (data.isActive && data.reason && data.reason.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'If provided, reason must be at least 3 characters',
      });
    }
  });

export const reviewVerificationSchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    reason: z
      .string()
      .trim()
      .min(3, 'A verification decision reason of at least 3 characters is required')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export const moderateJobSchema = z
  .object({
    moderationStatus: z.enum(['approved', 'flagged', 'rejected']),
    status: z.enum(['active', 'closed', 'draft']).optional(),
    reason: z
      .string()
      .trim()
      .min(3, 'A moderation reason of at least 3 characters is required')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export const moderateCourseSchema = z
  .object({
    moderationStatus: z.enum(['approved', 'flagged', 'rejected']),
    status: z.enum(['published', 'archived', 'draft']).optional(),
    reason: z
      .string()
      .trim()
      .min(3, 'A moderation reason of at least 3 characters is required')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type AdminPartnersQueryInput = z.infer<typeof adminPartnersQuerySchema>;
export type AdminJobsQueryInput = z.infer<typeof adminJobsQuerySchema>;
export type AdminCoursesQueryInput = z.infer<typeof adminCoursesQuerySchema>;
export type AdminVerificationsQueryInput = z.infer<typeof adminVerificationsQuerySchema>;
export type AdminAuditLogsQueryInput = z.infer<typeof adminAuditLogsQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
export type ModerateJobInput = z.infer<typeof moderateJobSchema>;
export type ModerateCourseInput = z.infer<typeof moderateCourseSchema>;

export const validateAdminIdParam = validateRequest(
  { params: z.object({ id: adminObjectIdSchema }) },
  'Invalid record identifier'
);

export const validateAdminOrgIdParam = validateRequest(
  { params: z.object({ orgId: adminObjectIdSchema }) },
  'Invalid organization identifier'
);

export const validateAdminUsersQuery = validateRequest(
  { query: adminUsersQuerySchema },
  'Invalid user list filter parameters'
);

export const validateAdminPartnersQuery = validateRequest(
  { query: adminPartnersQuerySchema },
  'Invalid organization partner query parameters'
);

export const validateAdminJobsQuery = validateRequest(
  { query: adminJobsQuerySchema },
  'Invalid admin job filter parameters'
);

export const validateAdminCoursesQuery = validateRequest(
  { query: adminCoursesQuerySchema },
  'Invalid admin course filter parameters'
);

export const validateAdminVerificationsQuery = validateRequest(
  { query: adminVerificationsQuerySchema },
  'Invalid verification queue parameters'
);

export const validateAdminAuditLogsQuery = validateRequest(
  { query: adminAuditLogsQuerySchema },
  'Invalid audit log query parameters'
);

export const validateUpdateUserStatus = validateRequest(
  {
    params: z.object({ id: adminObjectIdSchema }),
    body: updateUserStatusSchema,
  },
  'Account status update validation failed'
);

export const validateReviewVerification = validateRequest(
  {
    params: z.object({ orgId: adminObjectIdSchema }),
    body: reviewVerificationSchema,
  },
  'Verification decision validation failed'
);

export const validateModerateJob = validateRequest(
  {
    params: z.object({ id: adminObjectIdSchema }),
    body: moderateJobSchema,
  },
  'Job moderation validation failed'
);

export const adminAiHealthQuerySchema = z.object({
  verify: z.enum(['true', 'false']).optional().default('false'),
});

export const validateAdminAiHealthQuery = validateRequest(
  { query: adminAiHealthQuerySchema },
  'Invalid AI health query parameters'
);

export const validateModerateCourse = validateRequest(
  {
    params: z.object({ id: adminObjectIdSchema }),
    body: moderateCourseSchema,
  },
  'Course moderation validation failed'
);
