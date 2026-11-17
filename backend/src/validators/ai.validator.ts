import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Must be a valid resource ID.');

export const resumeAnalyzeBodySchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
});

export const skillExtractBodySchema = z.object({
  resumeId: objectIdSchema.optional(),
  includeProfile: z.boolean().optional().default(true),
  forceRefresh: z.boolean().optional().default(false),
});

export const applyExtractedSkillsSchema = z.object({
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        category: z.enum(['technical', 'soft', 'tool', 'framework', 'language']).optional(),
        level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
      })
    )
    .min(1, 'Select at least one skill to apply.')
    .max(50),
});

export const skillGapBodySchema = z
  .object({
    jobId: objectIdSchema.optional(),
    targetRole: z.string().trim().min(2).max(120).optional(),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
    forceRefresh: z.boolean().optional().default(false),
  })
  .refine((data) => Boolean(data.jobId || data.targetRole), {
    message: 'Provide either a target jobId or a targetRole.',
    path: ['targetRole'],
  });

export const generateRoadmapBodySchema = z
  .object({
    jobId: objectIdSchema.optional(),
    targetRole: z.string().trim().min(2).max(120).optional(),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
    missingSkills: z.array(z.string().trim().min(1).max(80)).max(25).optional(),
    weeklyHours: z.number().int().min(1).max(60).optional().default(8),
  })
  .refine((data) => Boolean(data.jobId || data.targetRole), {
    message: 'Provide either a target jobId or a targetRole.',
    path: ['targetRole'],
  });

export const toggleRoadmapStepBodySchema = z.object({
  isCompleted: z.boolean(),
});

export const regenerateRoadmapBodySchema = z.object({
  missingSkills: z.array(z.string().trim().min(1).max(80)).max(25).optional(),
  weeklyHours: z.number().int().min(1).max(60).optional().default(8),
});

export const updateRoadmapStatusBodySchema = z.object({
  status: z.enum(['active', 'archived']),
});

export const jobRecommendationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  locationType: z.enum(['on-site', 'remote', 'hybrid']).optional(),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']).optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  sortBy: z.enum(['matchScore', 'newest']).optional().default('matchScore'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const jobMatchBodySchema = z.object({
  includeAiExplanation: z.boolean().optional().default(true),
});

export const aiChatBodySchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty.').max(2000),
  conversationId: objectIdSchema.optional(),
  topic: z.enum(['general', 'resume', 'skills', 'interview', 'job_search']).optional(),
  includeProfileContext: z.boolean().optional().default(true),
});
