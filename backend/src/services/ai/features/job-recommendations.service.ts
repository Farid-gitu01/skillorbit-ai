import { Application } from '../../../models/Application.model.js';
import { type ExperienceLevel, Job, type JobLocationType, type JobType } from '../../../models/Job.model.js';
import { Profile } from '../../../models/Profile.model.js';
import {
  buildActiveJobFilter,
  evaluateDeterministicJobMatch,
  type LeanMatchableJob,
  loadSeekerMatchContext,
} from './job-matching.service.js';

export interface RecommendationFilterOptions {
  userId: string;
  q?: string;
  locationType?: JobLocationType;
  type?: JobType;
  experienceLevel?: ExperienceLevel;
  minScore?: number;
  sortBy?: 'matchScore' | 'newest';
  limit?: number;
}

export interface RecommendedJobItem {
  jobId: string;
  title: string;
  companyName?: string;
  location: string;
  locationType: string;
  type: string;
  experienceLevel: string;
  applicationDeadline?: Date;
  createdAt: Date;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  hasApplied: boolean;
  isSaved: boolean;
}

export interface JobRecommendationsResult {
  recommendations: RecommendedJobItem[];
  totalMatched: number;
  profileCompleteForMatching: boolean;
  profileGuidance?: string;
}

export async function getPersonalizedJobRecommendations(
  options: RecommendationFilterOptions
): Promise<JobRecommendationsResult> {
  const {
    userId,
    q,
    locationType,
    type,
    experienceLevel,
    minScore = 0,
    sortBy = 'matchScore',
    limit = 20,
  } = options;

  const query: Record<string, unknown> = buildActiveJobFilter();
  if (locationType) query.locationType = locationType;
  if (type) query.type = type;
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (q && q.trim()) {
    const safeRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [{ $or: [{ title: safeRegex }, { description: safeRegex }, { location: safeRegex }] }];
  }

  const [seeker, jobs, applications, profile] = await Promise.all([
    loadSeekerMatchContext(userId),
    Job.find(query)
      .populate('skills', 'name')
      .populate('organization', 'name')
      .select(
        'title description qualifications skills location locationType type experienceLevel applicationDeadline organization createdAt'
      )
      .sort({ createdAt: -1 })
      .limit(120)
      .lean(),
    Application.find({ seeker: userId, status: { $ne: 'withdrawn' } }).select('job').lean(),
    Profile.findOne({ user: userId }).select('savedJobs').lean(),
  ]);

  const appliedJobIds = new Set(applications.map((a) => a.job.toString()));
  const savedJobIds = new Set((profile?.savedJobs ?? []).map((id) => id.toString()));

  const seenJobIds = new Set<string>();
  const scored: RecommendedJobItem[] = [];

  for (const rawJob of jobs) {
    const job = rawJob as unknown as LeanMatchableJob & { createdAt: Date };
    const id = job._id.toString();
    if (seenJobIds.has(id)) continue;
    seenJobIds.add(id);

    const match = evaluateDeterministicJobMatch(seeker, job);
    if (match.matchScore < minScore) {
      continue;
    }

    const reasons: string[] = [];
    if (match.matchedSkills.length > 0) {
      reasons.push(
        `Matches ${match.matchedSkills.length} of your listed skills (${match.matchedSkills.slice(0, 3).join(', ')}).`
      );
    }
    if (match.breakdown.experienceScore >= 14) {
      reasons.push(`Experience aligns with ${job.experienceLevel ?? 'target'} level expectations.`);
    }
    if (job.locationType === 'remote') {
      reasons.push('Remote work arrangement fits broad location flexibility.');
    } else if (match.breakdown.roleAndLocationFitScore >= 7 && job.location) {
      reasons.push(`Role title or location aligns with your profile (${job.location}).`);
    }
    if (reasons.length === 0) {
      reasons.push('Active opportunity matching your selected search filters.');
    }

    scored.push({
      jobId: id,
      title: job.title,
      companyName: job.organization?.name,
      location: job.location ?? 'Flexible',
      locationType: job.locationType ?? 'on-site',
      type: job.type ?? 'full-time',
      experienceLevel: job.experienceLevel ?? 'mid',
      applicationDeadline: job.applicationDeadline,
      createdAt: job.createdAt,
      matchScore: match.matchScore,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      reasons,
      hasApplied: appliedJobIds.has(id),
      isSaved: savedJobIds.has(id),
    });
  }

  scored.sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const capped = scored.slice(0, Math.min(50, Math.max(1, limit)));

  return {
    recommendations: capped,
    totalMatched: scored.length,
    profileCompleteForMatching: seeker.profileHasSubstantiveData,
    profileGuidance: seeker.profileHasSubstantiveData
      ? undefined
      : 'Add skills, experience, or analyze a resume on your profile to improve personalized job match scores.',
  };
}
