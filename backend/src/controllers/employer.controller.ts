import { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Application, type ApplicationStatus } from '../models/Application.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Job } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Organization } from '../models/Organization.model.js';
import { Profile } from '../models/Profile.model.js';
import { User } from '../models/user.model.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import {
  calculateOrganizationCompletion,
  recordEmployerAudit,
} from '../utils/employer.util.js';
import type { UpsertOrganizationInput } from '../validators/employer.validator.js';

interface ActivityFeedItem {
  _id: string;
  action: string;
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
}

const AUDIT_LABELS: Record<string, { title: string; format: (changes?: Record<string, unknown>) => string }> = {
  ORGANIZATION_UPDATED: {
    title: 'Organization profile updated',
    format: (changes) =>
      typeof changes?.name === 'string'
        ? `Updated profile for ${changes.name}`
        : 'Updated company details and profile',
  },
  JOB_CREATED: {
    title: 'New job created',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Created "${changes.title}" (${String(changes?.status ?? 'draft')})`
        : 'Created a new job posting',
  },
  JOB_UPDATED: {
    title: 'Job details updated',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Updated "${changes.title}"`
        : 'Updated job posting details',
  },
  JOB_STATUS_CHANGED: {
    title: 'Job status changed',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `"${changes.title}" marked as ${String(changes?.status ?? 'updated')}`
        : `Job marked as ${String(changes?.status ?? 'updated')}`,
  },
  JOB_DELETED: {
    title: 'Job deleted',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Removed "${changes.title}"`
        : 'Removed a job posting',
  },
  APPLICATION_STATUS_UPDATED: {
    title: 'Application status updated',
    format: (changes) =>
      typeof changes?.status === 'string'
        ? `Moved application to ${changes.status}`
        : 'Updated candidate application status',
  },
  APPLICATION_NOTE_UPDATED: {
    title: 'Application note saved',
    format: () => 'Updated internal evaluation note on application',
  },
};

export const getEmployerDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const [user, organization, employerJobs, recentNotifications, unreadNotificationsCount, auditLogs] =
    await Promise.all([
      User.findById(userId).select('name email role createdAt').lean(),
      Organization.findOne({ owner: userId, type: 'employer', isDeleted: false }).lean(),
      Job.find({ employer: userId, isDeleted: false })
        .select('title status location locationType type salary openings applicantCount applicationDeadline createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ recipient: userId, read: false }),
      AuditLog.find({ actor: userId }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

  const organizationCompletion = calculateOrganizationCompletion(organization);

  const jobStats = {
    total: employerJobs.length,
    active: 0,
    draft: 0,
    closed: 0,
    expired: 0,
  };

  for (const job of employerJobs) {
    if (job.status === 'active') jobStats.active += 1;
    else if (job.status === 'draft') jobStats.draft += 1;
    else if (job.status === 'closed') jobStats.closed += 1;
    else if (job.status === 'expired') jobStats.expired += 1;
  }

  const jobIds = employerJobs.map((j) => j._id);

  const applicationStats = {
    total: 0,
    pending: 0,
    reviewed: 0,
    shortlisted: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
  };

  let recentApplications: Array<Record<string, unknown>> = [];

  if (jobIds.length > 0) {
    const [statusCounts, recentApps] = await Promise.all([
      Application.aggregate<{ _id: ApplicationStatus; count: number }>([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.find({ job: { $in: jobIds } })
        .populate('seeker', 'name email')
        .populate('job', 'title location locationType type')
        .populate('resume', 'fileName fileSize')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    for (const row of statusCounts) {
      applicationStats[row._id] = row.count;
      applicationStats.total += row.count;
    }

    recentApplications = recentApps as unknown as Array<Record<string, unknown>>;
  }

  // Synthesize chronological recent dashboard activity from AuditLog + recent incoming applications
  const activityItems: ActivityFeedItem[] = auditLogs.map((log) => {
    const descriptor = AUDIT_LABELS[log.action];
    let link: string | undefined;
    if (log.resource === 'Job' && log.resourceId && log.action !== 'JOB_DELETED') {
      link = `/employer/jobs/${String(log.resourceId)}`;
    } else if (log.resource === 'Application' && log.resourceId) {
      link = `/employer/applications/${String(log.resourceId)}`;
    } else if (log.resource === 'Organization') {
      link = '/employer/organization';
    }

    return {
      _id: String(log._id),
      action: log.action,
      title: descriptor ? descriptor.title : log.action.replace(/_/g, ' ').toLowerCase(),
      description: descriptor ? descriptor.format(log.changes) : 'Dashboard activity recorded',
      timestamp: log.createdAt,
      link,
    };
  });

  for (const app of recentApplications.slice(0, 4)) {
    const appId = String(app._id);
    const seeker = app.seeker as { name?: string } | undefined;
    const job = app.job as { title?: string } | undefined;
    const createdAt = app.createdAt as Date;

    activityItems.push({
      _id: `app-${appId}`,
      action: 'APPLICATION_RECEIVED',
      title: 'Candidate application received',
      description: `${seeker?.name ?? 'A candidate'} applied for ${job?.title ?? 'your job posting'}`,
      timestamp: createdAt,
      link: `/employer/applications/${appId}`,
    });
  }

  activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  sendSuccess(res, 200, {
    user,
    organization,
    organizationCompletion,
    jobStats,
    applicationStats,
    recentJobs: employerJobs.slice(0, 5),
    recentApplications,
    recentActivity: activityItems.slice(0, 8),
    notifications: recentNotifications,
    unreadNotificationsCount,
  });
};

export const getMyOrganization = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const organization = await Organization.findOne({
    owner: userId,
    type: 'employer',
    isDeleted: false,
  }).lean();

  const completion = calculateOrganizationCompletion(organization);

  sendSuccess(res, 200, {
    organization,
    completionPercentage: completion.percentage,
    missingFields: completion.missingFields,
  });
};

export const upsertMyOrganization = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const input = req.body as UpsertOrganizationInput;

  const setFields: Record<string, unknown> = {
    name: input.name,
    type: 'employer',
    isDeleted: false,
  };
  const unsetFields: Record<string, 1> = {};

  const optionalKeys = [
    'industry',
    'size',
    'founded',
    'location',
    'description',
    'logoUrl',
    'websiteUrl',
    'contactEmail',
    'contactPhone',
  ] as const;

  for (const key of optionalKeys) {
    if (Object.hasOwn(input, key)) {
      const value = input[key];
      if (value === undefined) {
        unsetFields[key] = 1;
      } else {
        setFields[key] = value;
      }
    }
  }

  if (Object.hasOwn(input, 'socialLinks')) {
    const rawLinks: Partial<Record<'linkedin' | 'twitter' | 'facebook' | 'github', string>> =
      input.socialLinks ?? {};
    const cleanedLinks: Record<string, string> = {};
    for (const linkKey of ['linkedin', 'twitter', 'facebook', 'github'] as const) {
      const val = rawLinks[linkKey];
      if (typeof val === 'string' && val.length > 0) {
        cleanedLinks[linkKey] = val;
      }
    }
    setFields.socialLinks = cleanedLinks;
  }

  const updateOp: Record<string, unknown> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) {
    updateOp.$unset = unsetFields;
  }

  const organization = await Organization.findOneAndUpdate(
    { owner: userId, type: 'employer', isDeleted: false },
    updateOp,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Link any existing employer jobs that don't yet reference an organization
  await Job.updateMany(
    {
      employer: userId,
      isDeleted: false,
      $or: [{ organization: { $exists: false } }, { organization: null }],
    },
    { $set: { organization: organization._id } }
  );

  await recordEmployerAudit({
    actorId: userId,
    action: 'ORGANIZATION_UPDATED',
    resource: 'Organization',
    resourceId: organization._id as mongoose.Types.ObjectId,
    changes: { name: organization.name },
    statusCode: 200,
  });

  const completion = calculateOrganizationCompletion(organization);

  sendSuccess(
    res,
    200,
    {
      organization,
      completionPercentage: completion.percentage,
      missingFields: completion.missingFields,
    },
    'Organization profile saved successfully'
  );
};

export const getEmployerCandidates = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const {
    q,
    status = 'all',
    jobId,
    shortlistedOnly,
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const employerJobs = await Job.find({ employer: userId, isDeleted: false })
    .select('_id title')
    .lean();

  const employerJobIds = employerJobs.map((j) => j._id);
  if (employerJobIds.length === 0) {
    sendPaginated(
      res,
      200,
      { candidates: [], shortlistedCount: 0 },
      { page: 1, limit: Number(limit) || 12, total: 0, pages: 1 }
    );
    return;
  }

  if (typeof jobId === 'string' && jobId.length > 0) {
    const ownsJob = employerJobIds.some((id) => String(id) === jobId);
    if (!ownsJob) {
      sendError(res, 404, 'Job not found', { code: 'JOB_NOT_FOUND' });
      return;
    }
  }

  const appFilter: Record<string, unknown> = {
    job: typeof jobId === 'string' && jobId.length > 0 ? new mongoose.Types.ObjectId(jobId) : { $in: employerJobIds },
    status: { $ne: 'withdrawn' },
  };

  if (shortlistedOnly === 'true') {
    appFilter.status = 'shortlisted';
  } else if (typeof status === 'string' && status !== 'all') {
    appFilter.status = status;
  }

  const [applications, shortlistedDistinctSeekers] = await Promise.all([
    Application.find(appFilter)
      .populate('job', 'title')
      .populate('resume', 'fileName fileSize mimeType')
      .sort({ createdAt: -1 })
      .lean(),
    Application.distinct('seeker', {
      job: { $in: employerJobIds },
      status: 'shortlisted',
    }),
  ]);

  if (applications.length === 0) {
    sendPaginated(
      res,
      200,
      { candidates: [], shortlistedCount: shortlistedDistinctSeekers.length },
      { page: 1, limit: Number(limit) || 12, total: 0, pages: 1 }
    );
    return;
  }

  const candidateAppsMap = new Map<string, typeof applications>();
  for (const app of applications) {
    const seekerId = String(app.seeker);
    const list = candidateAppsMap.get(seekerId) ?? [];
    list.push(app);
    candidateAppsMap.set(seekerId, list);
  }

  const seekerIds = Array.from(candidateAppsMap.keys()).map((id) => new mongoose.Types.ObjectId(id));

  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: seekerIds }, isDeleted: false }).select('name email').lean(),
    Profile.find({ user: { $in: seekerIds } })
      .select(
        'user headline bio location phone avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl'
      )
      .lean(),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  const searchNeedle = typeof q === 'string' ? q.trim().toLowerCase() : '';

  const assembled = Array.from(candidateAppsMap.entries())
    .map(([seekerId, apps]) => {
      const user = userMap.get(seekerId);
      if (!user) return null;
      const profile = profileMap.get(seekerId);
      const highestMatchScore = apps.reduce((max, item) => {
        const score = typeof item.aiMatchScore === 'number' ? item.aiMatchScore : 0;
        return score > max ? score : max;
      }, 0);

      return {
        _id: seekerId,
        name: user.name,
        email: user.email,
        profile: profile
          ? {
              headline: profile.headline,
              bio: profile.bio,
              location: profile.location,
              phone: profile.phone,
              avatarUrl: profile.avatarUrl,
              availability: profile.availability,
              skills: profile.skills ?? [],
              languages: profile.languages ?? [],
              experience: profile.experience ?? [],
              education: profile.education ?? [],
              linkedinUrl: profile.linkedinUrl,
              githubUrl: profile.githubUrl,
              portfolioUrl: profile.portfolioUrl,
            }
          : {
              skills: [],
              languages: [],
              experience: [],
              education: [],
            },
        applications: apps.map((a) => ({
          _id: String(a._id),
          job: a.job,
          status: a.status,
          aiMatchScore: a.aiMatchScore,
          resume: a.resume,
          createdAt: a.createdAt,
        })),
        latestApplication: {
          _id: String(apps[0]!._id),
          job: apps[0]!.job,
          status: apps[0]!.status,
          aiMatchScore: apps[0]!.aiMatchScore,
          resume: apps[0]!.resume,
          createdAt: apps[0]!.createdAt,
        },
        isShortlisted: apps.some((a) => a.status === 'shortlisted'),
        highestMatchScore,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((candidate) => {
      if (!searchNeedle) return true;
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.profile.headline ?? '',
        candidate.profile.location ?? '',
        ...candidate.profile.skills,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchNeedle);
    });

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
  const total = assembled.length;
  const pages = Math.ceil(total / limitNum) || 1;
  const start = (pageNum - 1) * limitNum;
  const paged = assembled.slice(start, start + limitNum);

  sendPaginated(
    res,
    200,
    { candidates: paged, shortlistedCount: shortlistedDistinctSeekers.length },
    { page: pageNum, limit: limitNum, total, pages }
  );
};

export const getEmployerCandidateById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const { candidateId } = req.params;

  const employerJobs = await Job.find({ employer: userId, isDeleted: false })
    .select('_id')
    .lean();
  const employerJobIds = employerJobs.map((j) => j._id);

  if (employerJobIds.length === 0) {
    sendError(res, 403, 'Access denied', { code: 'FORBIDDEN' });
    return;
  }

  const applications = await Application.find({
    seeker: candidateId,
    job: { $in: employerJobIds },
  })
    .populate('job', 'title location locationType type status')
    .populate('resume', 'fileName fileSize mimeType createdAt')
    .populate('statusHistory.changedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean();

  // Only employers who received a non-withdrawn application from this candidate can inspect their private details
  const hasActiveRelationship = applications.some((a) => a.status !== 'withdrawn');
  if (!hasActiveRelationship) {
    sendError(res, 403, 'Access denied — candidate has no active applications to your jobs', {
      code: 'FORBIDDEN',
    });
    return;
  }

  const [user, profile] = await Promise.all([
    User.findOne({ _id: candidateId, isDeleted: false }).select('name email createdAt').lean(),
    Profile.findOne({ user: candidateId })
      .select(
        'headline bio location phone avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl'
      )
      .lean(),
  ]);

  if (!user) {
    sendError(res, 404, 'Candidate not found', { code: 'CANDIDATE_NOT_FOUND' });
    return;
  }

  const resumeMap = new Map<string, Record<string, unknown>>();
  for (const app of applications) {
    if (app.status === 'withdrawn' || !app.resume) continue;
    const resumeObj = app.resume as unknown as Record<string, unknown>;
    if (resumeObj._id) {
      resumeMap.set(String(resumeObj._id), resumeObj);
    }
  }

  sendSuccess(res, 200, {
    candidate: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      profile: profile ?? {
        skills: [],
        languages: [],
        experience: [],
        education: [],
      },
      applications,
      resumes: Array.from(resumeMap.values()),
    },
  });
};
