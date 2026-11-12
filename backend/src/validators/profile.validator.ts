import { z } from 'zod';
import { validateRequest } from '../middlewares/validate-request.middleware.js';

export const experienceItemSchema = z.object({
  title: z.string().trim().min(1, 'Job title is required').max(100),
  company: z.string().trim().min(1, 'Company is required').max(100),
  location: z.string().trim().max(100).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  description: z.string().trim().max(1000).optional(),
});

export const educationItemSchema = z.object({
  institution: z.string().trim().min(1, 'Institution is required').max(150),
  degree: z.string().trim().max(100).optional(),
  field: z.string().trim().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  grade: z.string().trim().max(50).optional(),
});

export const updateProfileSchema = z.object({
  headline: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
  avatarUrl: z.string().trim().optional(),
  location: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  linkedinUrl: z.string().trim().url().or(z.literal('')).optional(),
  githubUrl: z.string().trim().url().or(z.literal('')).optional(),
  portfolioUrl: z.string().trim().url().or(z.literal('')).optional(),
  skills: z.array(z.string().trim().max(50)).optional(),
  languages: z.array(z.string().trim().max(50)).optional(),
  availability: z.enum(['immediate', '2-weeks', '1-month', 'not-looking']).optional(),
  experience: z.array(experienceItemSchema).optional(),
  education: z.array(educationItemSchema).optional(),
});

export const validateUpdateProfile = validateRequest({
  body: updateProfileSchema,
});
