import { z } from 'zod';
import { Profile } from '../../../models/Profile.model.js';
import { type IResume, Resume } from '../../../models/Resume.model.js';
import { Skill } from '../../../models/Skill.model.js';
import { type ProficiencyLevel, UserSkill } from '../../../models/UserSkill.model.js';
import { ApplicationError } from '../../../utils/application-error.js';
import {
  aiService,
  type AiService,
  defineAiPrompt,
  wrapUntrustedUserBlock,
} from '../index.js';
import { type AiResponseCache, sharedAiCache } from '../utils/ai-cache.util.js';
import { loadValidatedResumeText } from './resume-analysis.service.js';

const SKILL_EXTRACTION_CACHE_TTL_MS = 10 * 60 * 1000;

export type ExtractedSkillCategory = 'technical' | 'soft' | 'tool' | 'framework' | 'language';

export const extractedSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(['technical', 'soft', 'tool', 'framework', 'language']),
  suggestedLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
  evidence: z.string().trim().min(1).max(240),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

const skillExtractionAiOutputSchema = z.object({
  skills: z.array(extractedSkillSchema).max(60).default([]),
});

export interface NormalizedExtractedSkill {
  name: string;
  canonicalName: string;
  slug: string;
  category: ExtractedSkillCategory;
  suggestedLevel: ProficiencyLevel;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  alreadyInProfile: boolean;
  existingUserLevel?: ProficiencyLevel;
  existingSkillVerified: boolean;
}

const CANONICAL_ALIAS_MAP: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  es6: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  node: 'Node.js',
  reactjs: 'React',
  'react.js': 'React',
  react: 'React',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  expressjs: 'Express.js',
  'express.js': 'Express.js',
  express: 'Express.js',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  py: 'Python',
  python: 'Python',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  docker: 'Docker',
  aws: 'AWS',
  'amazon web services': 'AWS',
  git: 'Git',
};

export function toSkillSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+.#]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSkillName(rawName: string): string {
  const cleaned = rawName.trim().replace(/\s+/g, ' ');
  const aliasMatch = CANONICAL_ALIAS_MAP[cleaned.toLowerCase()];
  if (aliasMatch) {
    return aliasMatch;
  }
  return cleaned;
}

const skillExtractionPrompt = defineAiPrompt({
  id: 'skill_extraction',
  version: '1.0.0',
  feature: 'skill_extraction',
  defaultMaxTokens: 1500,
  defaultTemperature: 0.1,
  maxOutputChars: 10000,
  systemPrompt: [
    'You are a structured skill-extraction engine for SkillOrbit AI.',
    'Extract ONLY skills explicitly evidenced in the candidate resume and profile data inside <untrusted_input>.',
    'Never guess or extrapolate unstated skills. Deduplicate synonymous aliases.',
    'Categorize each skill strictly as one of: "technical", "soft", "tool", "framework", "language".',
    'Suggest proficiency only when clear experience context supports it ("beginner", "intermediate", "advanced", "expert").',
    'Respond with JSON ONLY in this schema:',
    '{',
    '  "skills": [',
    '    {',
    '      "name": string,',
    '      "category": "technical" | "soft" | "tool" | "framework" | "language",',
    '      "suggestedLevel": "beginner" | "intermediate" | "advanced" | "expert",',
    '      "evidence": string,',
    '      "confidence": "high" | "medium" | "low"',
    '    }',
    '  ]',
    '}',
  ].join('\n'),
  inputSchema: z.object({
    resumeText: z.string().trim().max(24000).optional(),
    profileContext: z.string().trim().max(8000).optional(),
  }),
  buildUserPrompt: ({ resumeText, profileContext }) => {
    const blocks: string[] = [];
    if (resumeText) {
      blocks.push(wrapUntrustedUserBlock('candidate_resume', resumeText, 24000));
    }
    if (profileContext) {
      blocks.push(wrapUntrustedUserBlock('candidate_profile', profileContext, 8000));
    }
    return blocks.join('\n\n');
  },
});

export interface ExtractSkillsResult {
  resumeId?: string;
  extractedSkills: NormalizedExtractedSkill[];
  cached: boolean;
  provider: string;
  model: string;
}

export async function extractSkillsForSeeker(options: {
  userId: string;
  resumeId?: string;
  includeProfile?: boolean;
  forceRefresh?: boolean;
  ai?: AiService;
  cache?: AiResponseCache;
}): Promise<ExtractSkillsResult> {
  const { userId, resumeId, includeProfile = true, forceRefresh = false } = options;
  const ai = options.ai ?? aiService;
  const cache = options.cache ?? sharedAiCache;

  let targetResume: IResume | null = resumeId
    ? await Resume.findById(resumeId).select('+parsedData.rawText')
    : await Resume.findOne({ user: userId, isPrimary: true }).select('+parsedData.rawText');

  if (!targetResume && !resumeId) {
    targetResume = await Resume.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('+parsedData.rawText');
  }

  if (resumeId && !targetResume) {
    throw new ApplicationError('Resume not found.', {
      statusCode: 404,
      code: 'RESUME_NOT_FOUND',
    });
  }

  if (targetResume && targetResume.user.toString() !== userId) {
    throw new ApplicationError('You are not authorized to extract skills from this resume.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  let resumeText: string | undefined;
  let resumeHash = 'no-resume';
  if (targetResume) {
    const loaded = await loadValidatedResumeText(targetResume);
    resumeText = loaded.text;
    resumeHash = loaded.contentHash;
  }

  let profileContext: string | undefined;
  if (includeProfile) {
    const profile = await Profile.findOne({ user: userId })
      .select('headline bio experience education skills languages')
      .lean();
    if (profile) {
      const parts = [
        profile.headline ? `Headline: ${profile.headline}` : '',
        profile.bio ? `Bio: ${profile.bio}` : '',
        profile.skills?.length ? `Listed Skills: ${profile.skills.join(', ')}` : '',
        profile.languages?.length ? `Languages: ${profile.languages.join(', ')}` : '',
        profile.experience?.length
          ? `Experience: ${profile.experience
              .map((exp) => `${exp.title} at ${exp.company}${exp.description ? ` - ${exp.description}` : ''}`)
              .join(' | ')}`
          : '',
        profile.education?.length
          ? `Education: ${profile.education
              .map((edu) => `${edu.degree} in ${edu.field} (${edu.institution})`)
              .join(' | ')}`
          : '',
      ].filter(Boolean);
      if (parts.length > 0) {
        profileContext = parts.join('\n').slice(0, 8000);
      }
    }
  }

  if (!resumeText && !profileContext) {
    throw new ApplicationError(
      'Please upload a readable resume or add profile experience/bio details before extracting skills.',
      {
        statusCode: 400,
        code: 'INSUFFICIENT_SOURCE_DATA',
      }
    );
  }

  const cacheKey = `skill-extraction:${userId}:${targetResume?._id.toString() ?? 'profile'}:${resumeHash}:${Boolean(profileContext)}`;
  const { value: aiPayload, cacheHit } = await cache.getOrCompute(
    cacheKey,
    SKILL_EXTRACTION_CACHE_TTL_MS,
    async () => {
      const res = await ai.executeStructuredPrompt({
        template: skillExtractionPrompt,
        input: { resumeText, profileContext },
        schema: skillExtractionAiOutputSchema,
      });
      return {
        skills: res.data.skills,
        provider: res.metadata.provider,
        model: res.metadata.model,
      };
    },
    { skipCache: forceRefresh }
  );

  // Load DB skills + seeker existing UserSkills + Profile.skills to normalize aliases cleanly
  const [catalogSkills, existingUserSkills, profileDoc] = await Promise.all([
    Skill.find({ isActive: true }).select('name slug aliases').lean(),
    UserSkill.find({ user: userId }).populate('skill', 'name slug aliases').lean(),
    Profile.findOne({ user: userId }).select('skills').lean(),
  ]);

  const catalogByToken = new Map<string, { name: string; slug: string }>();
  for (const item of catalogSkills) {
    catalogByToken.set(item.name.toLowerCase(), { name: item.name, slug: item.slug });
    catalogByToken.set(item.slug.toLowerCase(), { name: item.name, slug: item.slug });
    for (const alias of item.aliases ?? []) {
      catalogByToken.set(alias.toLowerCase(), { name: item.name, slug: item.slug });
    }
  }

  const userSkillBySlug = new Map<string, { level: ProficiencyLevel; isVerified: boolean }>();
  for (const us of existingUserSkills) {
    const populatedSkill = us.skill as unknown as { name?: string; slug?: string } | null;
    if (populatedSkill?.slug) {
      userSkillBySlug.set(populatedSkill.slug.toLowerCase(), {
        level: us.level,
        isVerified: us.isVerified,
      });
    }
  }
  const profileSkillSet = new Set(
    (profileDoc?.skills ?? []).map((item) => normalizeSkillName(item).toLowerCase())
  );

  const deduped = new Map<string, NormalizedExtractedSkill>();
  const rankConfidence: Record<'high' | 'medium' | 'low', number> = { high: 3, medium: 2, low: 1 };

  for (const item of aiPayload.skills) {
    const firstPass = normalizeSkillName(item.name);
    const catalogMatch =
      catalogByToken.get(firstPass.toLowerCase()) ??
      catalogByToken.get(item.name.trim().toLowerCase());
    const canonicalName = catalogMatch ? catalogMatch.name : firstPass;
    const slug = catalogMatch ? catalogMatch.slug : toSkillSlug(canonicalName);
    if (!slug) continue;

    const existingUserSkill = userSkillBySlug.get(slug.toLowerCase());
    const inProfile = Boolean(existingUserSkill) || profileSkillSet.has(canonicalName.toLowerCase());

    const candidate: NormalizedExtractedSkill = {
      name: item.name.trim(),
      canonicalName,
      slug,
      category: item.category,
      suggestedLevel: item.suggestedLevel,
      evidence: item.evidence.trim(),
      confidence: item.confidence,
      alreadyInProfile: inProfile,
      existingUserLevel: existingUserSkill?.level,
      existingSkillVerified: existingUserSkill?.isVerified ?? false,
    };

    const prev = deduped.get(slug);
    if (!prev || rankConfidence[candidate.confidence] > rankConfidence[prev.confidence]) {
      deduped.set(slug, candidate);
    }
  }

  return {
    resumeId: targetResume?._id.toString(),
    extractedSkills: Array.from(deduped.values()),
    cached: cacheHit,
    provider: aiPayload.provider,
    model: aiPayload.model,
  };
}

export interface ApprovedSkillInput {
  name: string;
  category?: ExtractedSkillCategory;
  level?: ProficiencyLevel;
}

export interface ApplySkillsResult {
  addedCount: number;
  skippedExistingCount: number;
  addedSkills: string[];
  skippedExistingSkills: string[];
  profileSkills: string[];
}

/**
 * Persists user-confirmed extracted skills to Skill catalog, UserSkill, and Profile.skills
 * WITHOUT overwriting existing manually maintained or verified user skills.
 */
export async function applyExtractedSkillsToProfile(options: {
  userId: string;
  skills: ApprovedSkillInput[];
}): Promise<ApplySkillsResult> {
  const { userId, skills } = options;

  const addedSkills: string[] = [];
  const skippedExistingSkills: string[] = [];

  const profile =
    (await Profile.findOne({ user: userId })) ??
    (await Profile.create({ user: userId, skills: [] }));

  const existingProfileSkillKeys = new Set(
    profile.skills.map((s) => normalizeSkillName(s).toLowerCase())
  );

  const uniqueRequests = new Map<string, { canonicalName: string; slug: string; category: string; level: ProficiencyLevel }>();
  for (const entry of skills) {
    const canonicalName = normalizeSkillName(entry.name);
    const slug = toSkillSlug(canonicalName);
    if (!slug || !canonicalName) continue;
    if (!uniqueRequests.has(slug)) {
      uniqueRequests.set(slug, {
        canonicalName,
        slug,
        category: entry.category ?? 'technical',
        level: entry.level ?? 'intermediate',
      });
    }
  }

  for (const reqSkill of uniqueRequests.values()) {
    let skillDoc = await Skill.findOne({
      $or: [
        { slug: reqSkill.slug },
        { name: new RegExp(`^${reqSkill.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    });

    if (!skillDoc) {
      skillDoc = await Skill.create({
        name: reqSkill.canonicalName,
        slug: reqSkill.slug,
        category: reqSkill.category,
        aliases: [],
        isActive: true,
      });
    }

    const existingUserSkill = await UserSkill.findOne({
      user: userId,
      skill: skillDoc._id,
    });

    if (existingUserSkill) {
      skippedExistingSkills.push(skillDoc.name);
    } else {
      await UserSkill.create({
        user: userId,
        skill: skillDoc._id,
        level: reqSkill.level,
        isVerified: false,
        source: 'resume',
      });
      addedSkills.push(skillDoc.name);
    }

    if (!existingProfileSkillKeys.has(skillDoc.name.toLowerCase())) {
      profile.skills.push(skillDoc.name);
      existingProfileSkillKeys.add(skillDoc.name.toLowerCase());
    }
  }

  await profile.save();

  return {
    addedCount: addedSkills.length,
    skippedExistingCount: skippedExistingSkills.length,
    addedSkills,
    skippedExistingSkills,
    profileSkills: profile.skills,
  };
}
