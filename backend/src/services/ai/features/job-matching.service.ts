import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Application } from '../../../models/Application.model.js';
import { type ExperienceLevel, Job } from '../../../models/Job.model.js';
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

const JOB_MATCH_CACHE_TTL_MS = 10 * 60 * 1000;

export const jobMatchExplanationSchema = z.object({
  summary: z.string().trim().min(10).max(800),
  fitHighlights: z.array(z.string().trim().min(2).max(240)).max(6).default([]),
  gapHighlights: z.array(z.string().trim().min(2).max(240)).max(6).default([]),
  recommendedAction: z.string().trim().min(5).max(350),
});

const jobMatchExplanationPrompt = defineAiPrompt({
  id: 'job_match_explanation',
  version: '1.0.0',
  feature: 'job_matching',
  defaultMaxTokens: 900,
  defaultTemperature: 0.15,
  maxOutputChars: 5000,
  systemPrompt: [
    'You are a transparent job-fit advisor for SkillOrbit AI.',
    'Explain a deterministic job compatibility breakdown between a candidate and an active job posting inside <untrusted_input>.',
    'Stay strictly grounded in the provided matched skills, missing skills, experience summary, and component scores.',
    'Do not guarantee hiring outcomes or fabricate candidate experience.',
    'Respond with JSON ONLY:',
    '{',
    '  "summary": string,',
    '  "fitHighlights": string[],',
    '  "gapHighlights": string[],',
    '  "recommendedAction": string',
    '}',
  ].join('\n'),
  inputSchema: z.object({
    jobSummary: z.string().trim().min(1).max(3000),
    candidateSummary: z.string().trim().min(1).max(3000),
    deterministicScores: z.string().trim().min(1).max(1500),
  }),
  buildUserPrompt: ({ jobSummary, candidateSummary, deterministicScores }) =>
    [
      wrapUntrustedUserBlock('active_job_summary', jobSummary, 3000),
      wrapUntrustedUserBlock('candidate_profile_summary', candidateSummary, 3000),
      wrapUntrustedUserBlock('deterministic_score_breakdown', deterministicScores, 1500),
    ].join('\n\n'),
});

export interface JobMatchScoreBreakdown {
  skillsScore: number;
  experienceScore: number;
  educationAndQualificationScore: number;
  roleAndLocationFitScore: number;
  methodology: string;
}

export interface JobMatchResult {
  jobId: string;
  jobTitle: string;
  companyName?: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  breakdown: JobMatchScoreBreakdown;
  explanation?: z.infer<typeof jobMatchExplanationSchema>;
  aiExplanationIncluded: boolean;
  cached: boolean;
}

export interface SeekerMatchContext {
  normalizedSkillSet: Set<string>;
  displaySkills: string[];
  headline: string;
  location: string;
  experienceTitles: string[];
  experienceYearsApprox: number;
  educationTexts: string[];
  profileHasSubstantiveData: boolean;
  contextHash: string;
}

const EXPERIENCE_LEVEL_MIN_YEARS: Record<ExperienceLevel, number> = {
  entry: 0,
  mid: 2,
  senior: 5,
  lead: 7,
  executive: 10,
};

function computeApproximateYears(
  experiences: Array<{ startDate?: Date; endDate?: Date }> | undefined
): number {
  if (!experiences || experiences.length === 0) return 0;
  let totalMonths = 0;
  const now = Date.now();
  for (const exp of experiences) {
    if (!exp.startDate) continue;
    const startMs = new Date(exp.startDate).getTime();
    const endMs = exp.endDate ? new Date(exp.endDate).getTime() : now;
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      totalMonths += Math.round((endMs - startMs) / (1000 * 60 * 60 * 24 * 30.4));
    }
  }
  return Math.round((totalMonths / 12) * 10) / 10;
}

export async function loadSeekerMatchContext(userId: string): Promise<SeekerMatchContext> {
  const [profile, userSkills, primaryResume] = await Promise.all([
    Profile.findOne({ user: userId })
      .select('headline location skills experience education')
      .lean(),
    UserSkill.find({ user: userId }).populate('skill', 'name').lean(),
    Resume.findOne({ user: userId, isPrimary: true })
      .select('parsedData.extractedSkills parsedData.yearsOfExperience parsedData.educationLevel')
      .lean(),
  ]);

  const skillMap = new Map<string, string>();
  for (const us of userSkills) {
    const populated = us.skill as unknown as { name?: string } | null;
    if (populated?.name) {
      const canonical = normalizeSkillName(populated.name);
      skillMap.set(canonical.toLowerCase(), canonical);
    }
  }
  for (const s of profile?.skills ?? []) {
    const canonical = normalizeSkillName(s);
    if (canonical && !skillMap.has(canonical.toLowerCase())) {
      skillMap.set(canonical.toLowerCase(), canonical);
    }
  }
  for (const s of primaryResume?.parsedData?.extractedSkills ?? []) {
    const canonical = normalizeSkillName(s);
    if (canonical && !skillMap.has(canonical.toLowerCase())) {
      skillMap.set(canonical.toLowerCase(), canonical);
    }
  }

  const profileExpYears = computeApproximateYears(profile?.experience);
  const experienceYearsApprox = Math.max(
    profileExpYears,
    primaryResume?.parsedData?.yearsOfExperience ?? 0
  );

  const experienceTitles = (profile?.experience ?? []).map((e) => e.title.toLowerCase());
  const educationTexts = [
    ...(profile?.education ?? []).map((e) => `${e.degree} ${e.field}`.toLowerCase()),
    primaryResume?.parsedData?.educationLevel?.toLowerCase() ?? '',
  ].filter(Boolean);

  const displaySkills = Array.from(skillMap.values());
  const normalizedSkillSet = new Set(skillMap.keys());
  const headline = profile?.headline?.trim() ?? '';
  const location = profile?.location?.trim() ?? '';
  const profileHasSubstantiveData =
    displaySkills.length > 0 || experienceTitles.length > 0 || headline.length > 0;

  const contextHash = createHash('sha256')
    .update(
      JSON.stringify({
        skills: displaySkills.slice().sort(),
        headline,
        location,
        years: experienceYearsApprox,
        edu: educationTexts,
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    normalizedSkillSet,
    displaySkills,
    headline,
    location,
    experienceTitles,
    experienceYearsApprox,
    educationTexts,
    profileHasSubstantiveData,
    contextHash,
  };
}

export interface LeanMatchableJob {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  qualifications?: string[];
  skills?: Array<{ _id?: mongoose.Types.ObjectId; name?: string } | mongoose.Types.ObjectId>;
  location?: string;
  locationType?: string;
  type?: string;
  experienceLevel?: ExperienceLevel;
  applicationDeadline?: Date;
  organization?: { name?: string };
}

export function evaluateDeterministicJobMatch(
  seeker: SeekerMatchContext,
  job: LeanMatchableJob
): {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  breakdown: JobMatchScoreBreakdown;
} {
  const jobSkills = ((job.skills as unknown as Array<{ name?: string }>) ?? [])
    .map((s) => (s && typeof s === 'object' && 'name' in s && s.name ? normalizeSkillName(s.name) : ''))
    .filter(Boolean);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const jobSkill of jobSkills) {
    const key = jobSkill.toLowerCase();
    if (
      seeker.normalizedSkillSet.has(key) ||
      Array.from(seeker.normalizedSkillSet).some((s) => s.includes(key) || key.includes(s))
    ) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  }

  // Fallback keyword overlap when job has no linked Skill documents
  let skillsScore = 0;
  if (jobSkills.length > 0) {
    skillsScore = Math.round((matchedSkills.length / jobSkills.length) * 50);
  } else if (seeker.displaySkills.length > 0) {
    const descLower = `${job.title} ${job.description}`.toLowerCase();
    const hits = seeker.displaySkills.filter((sk) => descLower.includes(sk.toLowerCase()));
    skillsScore = Math.min(45, hits.length * 10);
  }

  // 2. Experience level fit (20 points)
  const requiredYears = job.experienceLevel
    ? EXPERIENCE_LEVEL_MIN_YEARS[job.experienceLevel] ?? 0
    : 0;
  let experienceScore = 20;
  if (requiredYears > 0) {
    if (seeker.experienceYearsApprox >= requiredYears) {
      experienceScore = 20;
    } else if (seeker.experienceYearsApprox >= requiredYears * 0.6) {
      experienceScore = 14;
    } else if (seeker.experienceYearsApprox > 0) {
      experienceScore = 8;
    } else if (seeker.experienceTitles.length > 0) {
      experienceScore = 10;
    } else {
      experienceScore = 4;
    }
  }

  // 3. Education & qualification fit (15 points)
  let educationAndQualificationScore = 8;
  const qualText = (job.qualifications ?? []).join(' ').toLowerCase();
  if (!qualText) {
    educationAndQualificationScore = seeker.educationTexts.length > 0 ? 15 : 10;
  } else if (seeker.educationTexts.length > 0) {
    const tokens = qualText.split(/\W+/).filter((t) => t.length >= 4);
    const hasEduMatch = seeker.educationTexts.some((edu) =>
      tokens.some((tok) => edu.includes(tok))
    );
    educationAndQualificationScore = hasEduMatch ? 15 : 10;
  } else {
    educationAndQualificationScore = 4;
  }

  // 4. Role title & location alignment (15 points)
  let roleAndLocationFitScore = 0;
  const titleWords = job.title
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3);
  const candidateRoleBlob = `${seeker.headline} ${seeker.experienceTitles.join(' ')}`.toLowerCase();
  if (titleWords.some((w) => candidateRoleBlob.includes(w))) {
    roleAndLocationFitScore += 8;
  }
  if (
    job.locationType === 'remote' ||
    (seeker.location &&
      job.location &&
      job.location.toLowerCase().includes(seeker.location.toLowerCase().split(',')[0] ?? ''))
  ) {
    roleAndLocationFitScore += 7;
  } else if (seeker.location) {
    roleAndLocationFitScore += 2;
  }

  const totalScore = Math.max(
    0,
    Math.min(100, skillsScore + experienceScore + educationAndQualificationScore + roleAndLocationFitScore)
  );

  return {
    matchScore: totalScore,
    matchedSkills,
    missingSkills,
    breakdown: {
      skillsScore,
      experienceScore,
      educationAndQualificationScore,
      roleAndLocationFitScore,
      methodology:
        'Transparent weighted fit score (0–100): Skills overlap 50 pts, Experience alignment 20 pts, Education/Qualifications 15 pts, Role title & location compatibility 15 pts.',
    },
  };
}

export function buildActiveJobFilter(now = new Date()): Record<string, unknown> {
  return {
    status: 'active',
    isDeleted: false,
    moderationStatus: { $ne: 'rejected' },
    $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: null }, { applicationDeadline: { $gt: now } }],
  };
}

export async function computeJobMatchForSeeker(options: {
  userId: string;
  jobId: string;
  includeAiExplanation?: boolean;
  ai?: AiService;
  cache?: AiResponseCache;
}): Promise<JobMatchResult> {
  const { userId, jobId, includeAiExplanation = true } = options;
  const ai = options.ai ?? aiService;
  const cache = options.cache ?? sharedAiCache;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApplicationError('Invalid job ID.', {
      statusCode: 400,
      code: 'INVALID_JOB_ID',
    });
  }

  const job = (await Job.findOne({
    _id: jobId,
    ...buildActiveJobFilter(),
  })
    .populate('skills', 'name')
    .populate('organization', 'name')
    .select(
      'title description qualifications skills location locationType type experienceLevel applicationDeadline organization'
    )
    .lean()) as unknown as LeanMatchableJob | null;

  if (!job) {
    throw new ApplicationError('Job not found, expired, or no longer accepting applications.', {
      statusCode: 404,
      code: 'JOB_NOT_FOUND',
    });
  }

  const seeker = await loadSeekerMatchContext(userId);
  const deterministic = evaluateDeterministicJobMatch(seeker, job);

  let explanation: z.infer<typeof jobMatchExplanationSchema> | undefined;
  let aiExplanationIncluded = false;
  let cached = false;

  if (includeAiExplanation && ai.isConfigured()) {
    const cacheKey = `job-match-explain:${userId}:${jobId}:${seeker.contextHash}:${deterministic.matchScore}`;
    const result = await cache.getOrCompute<z.infer<typeof jobMatchExplanationSchema>>(
      cacheKey,
      JOB_MATCH_CACHE_TTL_MS,
      async () => {
        const res = await ai.executeStructuredPrompt({
          template: jobMatchExplanationPrompt,
          input: {
            jobSummary: [
              `Title: ${job.title}`,
              `Level: ${job.experienceLevel ?? 'mid'}`,
              `Location: ${job.location ?? 'Not specified'} (${job.locationType ?? 'on-site'})`,
              `Qualifications: ${(job.qualifications ?? []).join('; ') || 'Not specified'}`,
            ].join('\n'),
            candidateSummary: [
              `Headline: ${seeker.headline || 'Not provided'}`,
              `Skills: ${seeker.displaySkills.join(', ') || 'None listed'}`,
              `Approx Experience Years: ${seeker.experienceYearsApprox}`,
              `Location: ${seeker.location || 'Not specified'}`,
            ].join('\n'),
            deterministicScores: JSON.stringify({
              totalMatchScore: deterministic.matchScore,
              matchedSkills: deterministic.matchedSkills,
              missingSkills: deterministic.missingSkills,
              breakdown: deterministic.breakdown,
            }),
          },
          schema: jobMatchExplanationSchema,
        });
        return res.data;
      }
    );
    explanation = result.value;
    cached = result.cacheHit;
    aiExplanationIncluded = true;
  }

  // Persist AI match insight on existing active seeker application if one already exists
  await Application.updateOne(
    { seeker: userId, job: jobId, status: { $ne: 'withdrawn' } },
    {
      $set: {
        aiMatchScore: deterministic.matchScore,
        aiMatchDetails: {
          matchedSkills: deterministic.matchedSkills,
          missingSkills: deterministic.missingSkills,
          experienceMatch: deterministic.breakdown.experienceScore >= 14,
          summary: explanation?.summary ?? deterministic.breakdown.methodology,
        },
      },
    }
  ).catch(() => undefined);

  return {
    jobId: job._id.toString(),
    jobTitle: job.title,
    companyName: job.organization?.name,
    matchScore: deterministic.matchScore,
    matchedSkills: deterministic.matchedSkills,
    missingSkills: deterministic.missingSkills,
    breakdown: deterministic.breakdown,
    explanation,
    aiExplanationIncluded,
    cached,
  };
}
