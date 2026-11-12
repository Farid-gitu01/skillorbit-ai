import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

export const applyJobSchema = z.object({
  jobId: z.string().trim().min(1, 'Job ID is required'),
  resumeId: z.string().trim().optional(),
  coverLetter: z.string().trim().max(5000, 'Cover letter cannot exceed 5000 characters').optional(),
});

export const validateApplyJob = validateRequest({
  body: applyJobSchema,
});
