import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

export const getJobsQuerySchema = z.object({
  q: z.string().trim().optional(),
  location: z.string().trim().optional(),
  locationType: z.enum(['on-site', 'remote', 'hybrid']).optional(),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']).optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'oldest', 'deadline']).default('newest'),
});

export const validateGetJobs = validateRequest({
  query: getJobsQuerySchema,
});
