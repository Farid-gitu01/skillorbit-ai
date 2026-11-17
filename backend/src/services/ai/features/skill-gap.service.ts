import { z } from 'zod';
import { Course } from '../../../models/Course.model.js';
import { Job } from '../../../models/Job.model.js';
import { Profile } from '../../../models/Profile.model.js';
import { Resume } from '../../../models/Resume.model.js';
import { UserSkill } from '../../../models/UserSkill.model.js';
import { ApplicationError } from '../../../utils/application-error.js';
import {
  aiService,
  type AiService,
  defineAiPrompt,
  wrapUntrustedUserBlock,
} from '../index.js';
import { type AiResponseCache, sharedAiCache } from '../utils/ai-cache.util.js';
import { normalizeSkillName } from './skill-extraction.service.js';

const SKILL_GAP_CACHE_TTL_MS = 10 * 60 * 1000;

export const skillGapAiOutputSchema = z.object({
  summary: z.string().trim().min(10).max(1500),
  matchedSkills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  partiallyMatchedSkills: z
    .array(
      z.object({
        skill: z.string().trim().min(1).max(100),
        currentEvidence: z.string().trim().min(1).max(300),
        gapDescription: z.string().trim().min(1).max(300),
      })
    )
    .max(30)
    .default([]),
  missingSkills: z
    .array(
      z.object({
        skill: z.string().trim().min(1).max(100),
        priority: z.enum(['critical', 'high', 'medium', 'low']),
        whyItMatters: z.string().trim().min(1).max(350),
        howToDevelop: z.string().trim().min(1).max(400),
      })
    )
    .max(35)
    .default([]),
  recommendedNextSteps: z.array(z.string().trim().min(1).max(350)).max(12).default([]),
});

const skillGapPrompt = defineAiPrompt({
  id: 'skill_gap_analysis',
  version: '1.0.0',
  feature: 'skill_gap_analysis',
  defaultMaxTokens: 1800,
  defaultTemperature: 0.15,
  maxOutputChars: 12000,
  systemPrompt: [
    'You are an objective career skill-gap analyst for SkillOrbit AI.',
    'Compare the seeker skills and background against the target role or job requirements provided inside <untrusted_input>.',
    'Identify exact matches, partial/adjacent matches, and genuinely missing skills ranked by practical impact.',
    'Never invent unrelated requirements or assume the candidate holds unstated certifications.',
    'Respond with JSON ONLY in this schema:',
    '{',
    '  "summary": string,',
    '  "matchedSkills": string[],',
    '  "partiallyMatchedSkills": [{ "skill": string, "currentEvidence": string, "gapDescription": string }],',
    '  "missingSkills": [{ "skill": string, "priority": "critical" | "high" | "medium" | "low", "whyItMatters": string, "howToDevelop": string }],',
    '  "recommendedNextSteps": string[]',
    '}',
  ].join('\n'),
  inputSchema: z.object({
    seekerSkills: z.string().trim().min(1).max(4000),
    seekerExperience: z.string().trim().max(4000),
    targetContext: z.string().trim().min(1).max(8000),
  }),
  buildUserPrompt: ({ seekerSkills, seekerExperience, targetContext }) =>
    [
      wrapUntrustedUserBlock('seeker_skills', seekerSkills, 4000),
      wrapUntrustedUserBlock('seeker_experience_summary', seekerExperience || 'None recorded', 4000),
      wrapUntrustedUserBlock('target_role_or_job', targetContext, 8000),
    ].join('\n\n'),
});

export interface InternalCourseSuggestion {
  courseId: string;
  title: string;
  level: string;
  deliveryMode: string;
  duration?: string;
  matchedSkills: string[];
}

export interface SkillGapResult {
  targetType: 'job' | 'role';
  targetJobId?: string;
  targetTitle: string;
  experienceLevel?: string;
  seekerSkillsUsed: string[];
  summary: string;
  matchedSkills: string[];
  partiallyMatchedSkills: z.infer<typeof skillGapAiOutputSchema>['partiallyMatchedSkills'];
  missingSkills: z.infer<typeof skillGapAiOutputSchema>['missingSkills'];
  recommendedNextSteps: string[];
  relatedCourses: InternalCourseSuggestion[];
  readinessEstimate: {
    coverageRatio: number;
    methodology: string;
  };
  cached: boolean;
  provider: string;
  model: string;
}

export async function loadSeekerSkillSnapshot(userId: string): Promise<{
  skills: string[];
  skillLevels: Array<{ name: string; level: string }>;
  experienceSummary: string;
}> {
  const [userSkills, profile, primaryResume] = await Promise.all([
    UserSkill.find({ user: userId }).populate('skill', 'name').lean(),
    Profile.findOne({ user: userId })
      .select('headline skills experience education')
      .lean(),
    Resume.findOne({ user: userId, isPrimary: true })
      .select('parsedData.extractedSkills parsedData.summary')
      .lean(),
  ]);

  const skillSet = new Map<string, string>();
  const skillLevels: Array<{ name: string; level: string }> = [];

  for (const us of userSkills) {
    const populated = us.skill as unknown as { name?: string } | null;
    if (populated?.name) {
      const canonical = normalizeSkillName(populated.name);
      skillSet.set(canonical.toLowerCase(), canonical);
      skillLevels.push({ name: canonical, level: us.level });
    }
  }

  for (const rawSkill of profile?.skills ?? []) {
    const canonical = normalizeSkillName(rawSkill);
    if (canonical && !skillSet.has(canonical.toLowerCase())) {
      skillSet.set(canonical.toLowerCase(), canonical);
    }
  }

  for (const rawSkill of primaryResume?.parsedData?.extractedSkills ?? []) {
    const canonical = normalizeSkillName(rawSkill);
    if (canonical && !skillSet.has(canonical.toLowerCase())) {
      skillSet.set(canonical.toLowerCase(), canonical);
    }
  }

  const expParts: string[] = [];
  if (profile?.headline) expParts.push(`Headline: ${profile.headline}`);
  if (profile?.experience?.length) {
    expParts.push(
      `Experience: ${profile.experience
        .map((e) => `${e.title} at ${e.company}`)
        .slice(0, 6)
        .join('; ')}`
    );
  }
  if (profile?.education?.length) {
    expParts.push(
      `Education: ${profile.education
        .map((e) => `${e.degree} in ${e.field}`)
        .slice(0, 4)
        .join('; ')}`
    );
  }
  if (primaryResume?.parsedData?.summary) {
    expParts.push(`Resume Summary: ${primaryResume.parsedData.summary}`);
  }

  return {
    skills: Array.from(skillSet.values()),
    skillLevels,
    experienceSummary: expParts.join('\n').slice(0, 4000),
  };
}

export async function analyzeSkillGapForSeeker(options: {
  userId: string;
  jobId?: string;
  targetRole?: string;
  experienceLevel?: string;
  forceRefresh?: boolean;
  ai?: AiService;
  cache?: AiResponseCache;
}): Promise<SkillGapResult> {
  const { userId, jobId, targetRole, experienceLevel, forceRefresh = false } = options;
  const ai = options.ai ?? aiService;
  const cache = options.cache ?? sharedAiCache;

  if (!jobId && !targetRole?.trim()) {
    throw new ApplicationError('Provide either a target jobId or a targetRole for skill-gap analysis.', {
      statusCode: 400,
      code: 'TARGET_REQUIRED',
    });
  }

  const snapshot = await loadSeekerSkillSnapshot(userId);
  if (snapshot.skills.length === 0 && !snapshot.experienceSummary) {
    throw new ApplicationError(
      'Your profile has no recorded skills or resume summary yet. Add skills or analyze a resume first.',
      {
        statusCode: 400,
        code: 'INSUFFICIENT_PROFILE_DATA',
      }
    );
  }

  let targetType: 'job' | 'role' = 'role';
  let targetTitle = targetRole?.trim() ?? '';
  let resolvedExperienceLevel = experienceLevel?.trim();
  let targetContext = '';
  let resolvedJobId: string | undefined;

  if (jobId) {
    const job = await Job.findOne({
      _id: jobId,
      status: 'active',
      isDeleted: false,
      moderationStatus: { $ne: 'rejected' },
    })
      .populate('skills', 'name')
      .select('title description responsibilities qualifications skills experienceLevel type locationType')
      .lean();

    if (!job) {
      throw new ApplicationError('Target job is not found or not currently active.', {
        statusCode: 404,
        code: 'JOB_NOT_FOUND',
      });
    }

    targetType = 'job';
    targetTitle = job.title;
    resolvedExperienceLevel = job.experienceLevel;
    resolvedJobId = job._id.toString();

    const jobSkills = ((job.skills as unknown as Array<{ name?: string }>) ?? [])
      .map((s) => s?.name)
      .filter((s): s is string => Boolean(s));

    targetContext = [
      `Job Title: ${job.title}`,
      `Experience Level: ${job.experienceLevel}`,
      `Required Skills: ${jobSkills.length ? jobSkills.join(', ') : 'Infer from qualifications & responsibilities'}`,
      job.qualifications?.length ? `Qualifications: ${job.qualifications.join('; ')}` : '',
      job.responsibilities?.length ? `Responsibilities: ${job.responsibilities.join('; ')}` : '',
      `Description: ${job.description.slice(0, 3500)}`,
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    targetContext = [
      `Target Role: ${targetTitle}`,
      resolvedExperienceLevel ? `Target Experience Level: ${resolvedExperienceLevel}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const seekerSkillsText = snapshot.skillLevels.length
    ? snapshot.skillLevels.map((s) => `${s.name} (${s.level})`).join(', ')
    : snapshot.skills.join(', ') || 'None explicitly listed';

  const cacheKey = `skill-gap:${userId}:${resolvedJobId ?? targetTitle.toLowerCase()}:${resolvedExperienceLevel ?? 'any'}:${snapshot.skills.slice().sort().join(',')}`;

  const { value: aiOutput, cacheHit } = await cache.getOrCompute<{
    data: z.infer<typeof skillGapAiOutputSchema>;
    provider: string;
    model: string;
  }>(
    cacheKey,
    SKILL_GAP_CACHE_TTL_MS,
    async () => {
      const res = await ai.executeStructuredPrompt({
        template: skillGapPrompt,
        input: {
          seekerSkills: seekerSkillsText,
          seekerExperience: snapshot.experienceSummary,
          targetContext,
        },
        schema: skillGapAiOutputSchema,
      });
      return {
        data: res.data,
        provider: res.metadata.provider,
        model: res.metadata.model,
      };
    },
    { skipCache: forceRefresh }
  );

  // Match missing skills against verified internal published courses in MongoDB
  const missingNames = aiOutput.data.missingSkills.map((m) => m.skill.toLowerCase());
  const publishedCourses = await Course.find({
    status: 'published',
    isDeleted: false,
    moderationStatus: { $ne: 'rejected' },
  })
    .populate('skills', 'name')
    .select('title level deliveryMode duration skills tags category')
    .limit(40)
    .lean();

  const relatedCourses: InternalCourseSuggestion[] = [];
  if (missingNames.length > 0) {
    for (const course of publishedCourses) {
      const courseSkillNames = ((course.skills as unknown as Array<{ name?: string }>) ?? [])
        .map((s) => s?.name)
        .filter((s): s is string => Boolean(s));

      const matched = courseSkillNames.filter((cs) =>
        missingNames.some((ms) => cs.toLowerCase().includes(ms) || ms.includes(cs.toLowerCase()))
      );

      if (
        matched.length > 0 ||
        missingNames.some(
          (ms) =>
            course.title.toLowerCase().includes(ms) ||
            (course.tags ?? []).some((tag) => tag.toLowerCase().includes(ms))
        )
      ) {
        relatedCourses.push({
          courseId: course._id.toString(),
          title: course.title,
          level: course.level ?? 'intermediate',
          deliveryMode: course.deliveryMode ?? 'self-paced',
          duration: course.duration !== undefined ? `${course.duration} hrs` : undefined,
          matchedSkills: matched.length > 0 ? matched : courseSkillNames.slice(0, 4),
        });
      }
    }
  }

  const matchedCount = aiOutput.data.matchedSkills.length;
  const partialCount = aiOutput.data.partiallyMatchedSkills.length;
  const missingCount = aiOutput.data.missingSkills.length;
  const totalCompared = matchedCount + partialCount + missingCount;
  const coverageRatio =
    totalCompared > 0
      ? Math.round(((matchedCount + partialCount * 0.5) / totalCompared) * 100)
      : 0;

  return {
    targetType,
    targetJobId: resolvedJobId,
    targetTitle,
    experienceLevel: resolvedExperienceLevel,
    seekerSkillsUsed: snapshot.skills,
    summary: aiOutput.data.summary,
    matchedSkills: aiOutput.data.matchedSkills,
    partiallyMatchedSkills: aiOutput.data.partiallyMatchedSkills,
    missingSkills: aiOutput.data.missingSkills,
    recommendedNextSteps: aiOutput.data.recommendedNextSteps,
    relatedCourses: relatedCourses.slice(0, 6),
    readinessEstimate: {
      coverageRatio,
      methodology:
        'Computed directly from exact matches (1.0x), partial matches (0.5x), and missing skills identified for this target.',
    },
    cached: cacheHit,
    provider: aiOutput.provider,
    model: aiOutput.model,
  };
}
