import mongoose from 'mongoose';
import { z } from 'zod';
import { Course } from '../../../models/Course.model.js';
import { Job } from '../../../models/Job.model.js';
import {
  type ILearningRoadmap,
  type IRoadmapStep,
  LearningRoadmap,
} from '../../../models/LearningRoadmap.model.js';
import { ApplicationError } from '../../../utils/application-error.js';
import {
  aiService,
  type AiService,
  defineAiPrompt,
  wrapUntrustedUserBlock,
} from '../index.js';
import { loadSeekerSkillSnapshot } from './skill-gap.service.js';

export const roadmapAiOutputSchema = z.object({
  title: z.string().trim().min(5).max(180),
  learningObjectives: z.array(z.string().trim().min(3).max(300)).min(1).max(8),
  estimatedTotalWeeks: z.number().int().min(1).max(52),
  milestones: z.array(z.string().trim().min(3).max(250)).min(1).max(10),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1).max(30),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().min(10).max(800),
        type: z.enum(['course', 'skill', 'project', 'reading']),
        skillName: z.string().trim().min(1).max(100),
        estimatedHours: z.number().int().min(1).max(200),
        topics: z.array(z.string().trim().min(1).max(140)).min(1).max(8),
        projectIdea: z.string().trim().max(400).optional(),
        milestone: z.string().trim().max(240).optional(),
        resourceSearchQuery: z.string().trim().min(2).max(150),
      })
    )
    .min(3)
    .max(15),
});

const roadmapPrompt = defineAiPrompt({
  id: 'learning_roadmap',
  version: '1.0.0',
  feature: 'learning_roadmap',
  defaultMaxTokens: 2200,
  defaultTemperature: 0.25,
  maxOutputChars: 14000,
  systemPrompt: [
    'You are a structured learning curriculum designer for SkillOrbit AI.',
    'Generate a progressive, practical step-by-step learning roadmap addressing the candidate missing skills toward their target role or job.',
    'IMPORTANT SAFETY RULE: Never fabricate external URLs, fake domains, or imaginary course links. Instead, provide concise "resourceSearchQuery" search keywords for each step.',
    'Order steps logically from foundational prerequisites to hands-on projects.',
    'Respond with JSON ONLY matching:',
    '{',
    '  "title": string,',
    '  "learningObjectives": string[],',
    '  "estimatedTotalWeeks": number,',
    '  "milestones": string[],',
    '  "steps": [',
    '    {',
    '      "order": number,',
    '      "title": string,',
    '      "description": string,',
    '      "type": "course" | "skill" | "project" | "reading",',
    '      "skillName": string,',
    '      "estimatedHours": number,',
    '      "topics": string[],',
    '      "projectIdea": string,',
    '      "milestone": string,',
    '      "resourceSearchQuery": string',
    '    }',
    '  ]',
    '}',
  ].join('\n'),
  inputSchema: z.object({
    targetTitle: z.string().trim().min(1).max(180),
    experienceLevel: z.string().trim().max(60).optional(),
    currentSkills: z.string().trim().max(3000),
    missingSkills: z.string().trim().max(3000),
    weeklyHours: z.number().int().min(1).max(60).default(8),
  }),
  buildUserPrompt: ({ targetTitle, experienceLevel, currentSkills, missingSkills, weeklyHours }) =>
    [
      wrapUntrustedUserBlock('target_role', `${targetTitle}${experienceLevel ? ` (${experienceLevel})` : ''}`, 250),
      wrapUntrustedUserBlock('current_skills', currentSkills || 'None recorded', 3000),
      wrapUntrustedUserBlock('priority_skill_gaps', missingSkills || 'General readiness skills for role', 3000),
      wrapUntrustedUserBlock('study_pace', `${weeklyHours} hours per week`, 60),
    ].join('\n\n'),
});

export function recalculateRoadmapProgress(roadmap: ILearningRoadmap): void {
  const total = roadmap.steps.length;
  if (total === 0) {
    roadmap.progress = 0;
    roadmap.currentStep = 0;
    return;
  }

  const completedCount = roadmap.steps.filter((step) => step.isCompleted).length;
  roadmap.progress = Math.round((completedCount / total) * 100);

  const firstPendingIndex = roadmap.steps.findIndex((step) => !step.isCompleted);
  roadmap.currentStep = firstPendingIndex === -1 ? total : firstPendingIndex + 1;

  if (completedCount === total) {
    roadmap.status = 'completed';
  } else if (roadmap.status === 'completed') {
    roadmap.status = 'active';
  }
}

async function resolveVerifiedInternalCoursesForSteps(
  steps: z.infer<typeof roadmapAiOutputSchema>['steps'],
  previousCompletedMap?: Map<string, Date | undefined>
): Promise<IRoadmapStep[]> {
  const publishedCourses = await Course.find({
    status: 'published',
    isDeleted: false,
    moderationStatus: { $ne: 'rejected' },
  })
    .populate('skills', 'name')
    .select('title skills tags')
    .limit(50)
    .lean();

  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step, index) => {
      const needle = step.skillName.toLowerCase();
      const matchedCourse = publishedCourses.find((course) => {
        const courseSkills = ((course.skills as unknown as Array<{ name?: string }>) ?? []).map(
          (s) => s?.name?.toLowerCase() ?? ''
        );
        return (
          courseSkills.some((cs) => cs === needle || cs.includes(needle) || needle.includes(cs)) ||
          course.title.toLowerCase().includes(needle) ||
          (course.tags ?? []).some((tag) => tag.toLowerCase() === needle)
        );
      });

      const titleKey = step.title.trim().toLowerCase();
      const skillKey = `skill:${step.skillName.trim().toLowerCase()}`;
      const wasCompleted =
        previousCompletedMap?.has(titleKey) || previousCompletedMap?.has(skillKey) || false;
      const completedAt =
        previousCompletedMap?.get(titleKey) ?? previousCompletedMap?.get(skillKey);

      return {
        order: index + 1,
        title: step.title,
        description: step.description,
        type: step.type,
        skillName: step.skillName,
        estimatedHours: step.estimatedHours,
        topics: step.topics,
        projectIdea: step.projectIdea,
        milestone: step.milestone,
        resourceId: matchedCourse?._id as mongoose.Types.ObjectId | undefined,
        // Internal catalog link only when verified course exists in MongoDB; never fabricated URL
        resourceUrl: matchedCourse ? `/seeker/courses/${matchedCourse._id.toString()}` : undefined,
        resourceSearchQuery: step.resourceSearchQuery,
        isCompleted: wasCompleted,
        completedAt: wasCompleted ? completedAt ?? new Date() : undefined,
      };
    });
}

export async function generateLearningRoadmapForSeeker(options: {
  userId: string;
  targetRole?: string;
  jobId?: string;
  experienceLevel?: string;
  missingSkills?: string[];
  weeklyHours?: number;
  ai?: AiService;
}): Promise<ILearningRoadmap> {
  const { userId, targetRole, jobId, experienceLevel, missingSkills, weeklyHours = 8 } = options;
  const ai = options.ai ?? aiService;

  let resolvedTargetTitle = targetRole?.trim() ?? '';
  let resolvedExperience = experienceLevel?.trim();
  let resolvedJobObjectId: mongoose.Types.ObjectId | undefined;
  let derivedJobSkills: string[] = [];

  if (jobId) {
    const job = await Job.findOne({
      _id: jobId,
      status: 'active',
      isDeleted: false,
      moderationStatus: { $ne: 'rejected' },
    })
      .populate('skills', 'name')
      .select('title experienceLevel skills')
      .lean();

    if (!job) {
      throw new ApplicationError('Target job is not found or no longer active.', {
        statusCode: 404,
        code: 'JOB_NOT_FOUND',
      });
    }

    resolvedTargetTitle = resolvedTargetTitle || job.title;
    resolvedExperience = resolvedExperience || job.experienceLevel;
    resolvedJobObjectId = job._id as mongoose.Types.ObjectId;
    derivedJobSkills = ((job.skills as unknown as Array<{ name?: string }>) ?? [])
      .map((s) => s?.name)
      .filter((s): s is string => Boolean(s));
  }

  if (!resolvedTargetTitle) {
    throw new ApplicationError('Provide a target role or active job to generate a learning roadmap.', {
      statusCode: 400,
      code: 'TARGET_REQUIRED',
    });
  }

  const snapshot = await loadSeekerSkillSnapshot(userId);
  const currentSkillsLower = new Set(snapshot.skills.map((s) => s.toLowerCase()));

  const gapSkillsList = (
    missingSkills && missingSkills.length > 0
      ? missingSkills
      : derivedJobSkills.filter((skill) => !currentSkillsLower.has(skill.toLowerCase()))
  )
    .map((s) => s.trim())
    .filter(Boolean);

  const aiResult = await ai.executeStructuredPrompt({
    template: roadmapPrompt,
    input: {
      targetTitle: resolvedTargetTitle,
      experienceLevel: resolvedExperience,
      currentSkills: snapshot.skills.join(', '),
      missingSkills: gapSkillsList.join(', '),
      weeklyHours,
    },
    schema: roadmapAiOutputSchema,
  });

  const resolvedSteps = await resolveVerifiedInternalCoursesForSteps(aiResult.data.steps);

  const roadmap = await LearningRoadmap.create({
    user: userId,
    title: aiResult.data.title,
    targetRole: resolvedTargetTitle,
    targetJob: resolvedJobObjectId,
    experienceLevel: resolvedExperience,
    learningObjectives: aiResult.data.learningObjectives,
    missingSkills: gapSkillsList,
    estimatedTotalWeeks: aiResult.data.estimatedTotalWeeks,
    milestones: aiResult.data.milestones,
    steps: resolvedSteps,
    currentStep: 1,
    progress: 0,
    status: 'active',
    generatedByAI: true,
  });

  return roadmap;
}

export async function listSeekerRoadmaps(userId: string): Promise<ILearningRoadmap[]> {
  return LearningRoadmap.find({ user: userId })
    .populate('targetJob', 'title status')
    .sort({ updatedAt: -1 })
    .lean() as unknown as Promise<ILearningRoadmap[]>;
}

export async function getSeekerRoadmapById(
  userId: string,
  roadmapId: string
): Promise<ILearningRoadmap> {
  const roadmap = await LearningRoadmap.findById(roadmapId).populate('targetJob', 'title status');
  if (!roadmap) {
    throw new ApplicationError('Learning roadmap not found.', {
      statusCode: 404,
      code: 'ROADMAP_NOT_FOUND',
    });
  }
  if (roadmap.user.toString() !== userId) {
    throw new ApplicationError('You are not authorized to access this learning roadmap.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  return roadmap;
}

export async function toggleRoadmapStepProgress(options: {
  userId: string;
  roadmapId: string;
  stepId: string;
  isCompleted: boolean;
}): Promise<ILearningRoadmap> {
  const roadmap = await getSeekerRoadmapById(options.userId, options.roadmapId);
  const step = roadmap.steps.find((s) => s._id?.toString() === options.stepId);
  if (!step) {
    throw new ApplicationError('Roadmap step not found.', {
      statusCode: 404,
      code: 'ROADMAP_STEP_NOT_FOUND',
    });
  }

  step.isCompleted = options.isCompleted;
  step.completedAt = options.isCompleted ? new Date() : undefined;

  recalculateRoadmapProgress(roadmap);
  await roadmap.save();
  return roadmap;
}

/**
 * Regenerates a roadmap cleanly while preserving user completion status on matching steps.
 */
export async function regenerateSeekerRoadmap(options: {
  userId: string;
  roadmapId: string;
  missingSkills?: string[];
  weeklyHours?: number;
  ai?: AiService;
}): Promise<ILearningRoadmap> {
  const roadmap = await getSeekerRoadmapById(options.userId, options.roadmapId);
  const ai = options.ai ?? aiService;

  const previousCompletedMap = new Map<string, Date | undefined>();
  for (const step of roadmap.steps) {
    if (step.isCompleted) {
      previousCompletedMap.set(step.title.trim().toLowerCase(), step.completedAt);
      if (step.skillName) {
        previousCompletedMap.set(`skill:${step.skillName.trim().toLowerCase()}`, step.completedAt);
      }
    }
  }

  const snapshot = await loadSeekerSkillSnapshot(options.userId);
  const gapSkills =
    options.missingSkills && options.missingSkills.length > 0
      ? options.missingSkills
      : roadmap.missingSkills ?? [];

  const aiResult = await ai.executeStructuredPrompt({
    template: roadmapPrompt,
    input: {
      targetTitle: roadmap.targetRole ?? roadmap.title,
      experienceLevel: roadmap.experienceLevel,
      currentSkills: snapshot.skills.join(', '),
      missingSkills: gapSkills.join(', '),
      weeklyHours: options.weeklyHours ?? 8,
    },
    schema: roadmapAiOutputSchema,
  });

  const mergedSteps = await resolveVerifiedInternalCoursesForSteps(
    aiResult.data.steps,
    previousCompletedMap
  );

  roadmap.title = aiResult.data.title;
  roadmap.learningObjectives = aiResult.data.learningObjectives;
  roadmap.estimatedTotalWeeks = aiResult.data.estimatedTotalWeeks;
  roadmap.milestones = aiResult.data.milestones;
  roadmap.missingSkills = gapSkills;
  roadmap.steps = mergedSteps;
  roadmap.lastRegeneratedAt = new Date();
  recalculateRoadmapProgress(roadmap);

  await roadmap.save();
  return roadmap;
}

export async function updateRoadmapStatus(options: {
  userId: string;
  roadmapId: string;
  status: 'active' | 'archived';
}): Promise<ILearningRoadmap> {
  const roadmap = await getSeekerRoadmapById(options.userId, options.roadmapId);
  roadmap.status = options.status;
  await roadmap.save();
  return roadmap;
}

export async function deleteSeekerRoadmap(userId: string, roadmapId: string): Promise<void> {
  const roadmap = await getSeekerRoadmapById(userId, roadmapId);
  await roadmap.deleteOne();
}
