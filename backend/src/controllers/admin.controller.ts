import { type Request, type Response } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import { Application } from '../models/Application.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Course } from '../models/Course.model.js';
import { Job } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Organization, type OrganizationType } from '../models/Organization.model.js';
import { Profile } from '../models/Profile.model.js';
import { Resume } from '../models/Resume.model.js';
import { User, type IUser, type UserRole } from '../models/user.model.js';
import {
  escapeRegex,
  formatAdminAuditEntry,
  isProtectedAdminTarget,
  notifyByAdmin,
  recordAdminAudit,
  resolveVerificationStatus,
  SAFE_USER_PROJECTION,
  sanitizeAdminUser,
} from '../utils/admin.util.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import { aiHealthService } from '../services/ai/index.js';
import type { UpdateUserStatusInput } from '../validators/admin.validator.js';

function getSortOption(sort: unknown): Record<string, 1 | -1> {
  if (sort === 'oldest') return { createdAt: 1 };
  if (sort === 'name') return { name: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export const getAdminDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const [
    totalUsers,
    seekersCount,
    employersCount,
    providersCount,
    adminsCount,
    activeAccountsCount,
    suspendedAccountsCount,
    totalJobs,
    activeJobsCount,
    draftJobsCount,
    closedJobsCount,
    flaggedJobsCount,
    rejectedJobsCount,
    totalCourses,
    publishedCoursesCount,
    flaggedCoursesCount,
    rejectedCoursesCount,
    totalApplications,
    totalOrganizations,
    verifiedOrganizationsCount,
    rejectedOrganizationsCount,
    pendingVerificationsCount,
    unreadNotificationsCount,
    recentUsersRaw,
    pendingOrgsRaw,
    recentLogsRaw,
    recentNotifications,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: false, role: 'seeker' }),
    User.countDocuments({ isDeleted: false, role: 'employer' }),
    User.countDocuments({ isDeleted: false, role: 'provider' }),
    User.countDocuments({ isDeleted: false, role: 'admin' }),
    User.countDocuments({ isDeleted: false, isActive: true }),
    User.countDocuments({ isDeleted: false, isActive: false }),
    Job.countDocuments({ isDeleted: false }),
    Job.countDocuments({ isDeleted: false, status: 'active' }),
    Job.countDocuments({ isDeleted: false, status: 'draft' }),
    Job.countDocuments({ isDeleted: false, status: 'closed' }),
    Job.countDocuments({ isDeleted: false, moderationStatus: 'flagged' }),
    Job.countDocuments({ isDeleted: false, moderationStatus: 'rejected' }),
    Course.countDocuments({ isDeleted: false }),
    Course.countDocuments({ isDeleted: false, status: 'published' }),
    Course.countDocuments({ isDeleted: false, moderationStatus: 'flagged' }),
    Course.countDocuments({ isDeleted: false, moderationStatus: 'rejected' }),
    Application.countDocuments({ isDeleted: false }),
    Organization.countDocuments({ isDeleted: false }),
    Organization.countDocuments({
      isDeleted: false,
      $or: [{ isVerified: true }, { verificationStatus: 'verified' }],
    }),
    Organization.countDocuments({ isDeleted: false, verificationStatus: 'rejected' }),
    Organization.countDocuments({
      isDeleted: false,
      isVerified: false,
      verificationStatus: { $ne: 'rejected' },
    }),
    Notification.countDocuments({ recipient: userId, read: false }),
    User.find({ isDeleted: false })
      .select(SAFE_USER_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Organization.find({
      isDeleted: false,
      isVerified: false,
      verificationStatus: { $ne: 'rejected' },
    })
      .populate('owner', 'name email role isActive')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    AuditLog.find({})
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const recentUsers = recentUsersRaw
    .map((user) => sanitizeAdminUser(user))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const pendingVerifications = pendingOrgsRaw.map((org) => ({
    ...org,
    verificationStatus: resolveVerificationStatus(org),
    owner: sanitizeAdminUser(org.owner),
  }));

  const recentActivities = recentLogsRaw.map((log) => formatAdminAuditEntry(log));

  sendSuccess(res, 200, {
    stats: {
      totalUsers,
      seekersCount,
      employersCount,
      providersCount,
      adminsCount,
      activeAccountsCount,
      suspendedAccountsCount,
      totalJobs,
      activeJobsCount,
      draftJobsCount,
      closedJobsCount,
      flaggedJobsCount,
      rejectedJobsCount,
      totalCourses,
      publishedCoursesCount,
      flaggedCoursesCount,
      rejectedCoursesCount,
      totalApplications,
      totalOrganizations,
      verifiedOrganizationsCount,
      rejectedOrganizationsCount,
      pendingVerificationsCount,
      unreadNotificationsCount,
    },
    recentUsers,
    pendingVerifications,
    recentActivities,
    recentNotifications,
  });
};

export const listAdminUsers = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    role = 'all',
    status = 'all',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<IUser> = { isDeleted: false };

  if (typeof role === 'string' && role !== 'all') {
    filter.role = role as UserRole;
  }

  if (status === 'active') {
    filter.isActive = true;
  } else if (status === 'suspended') {
    filter.isActive = false;
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [rawUsers, total] = await Promise.all([
    User.find(filter)
      .select(SAFE_USER_PROJECTION)
      .sort(getSortOption(sort))
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  const users = rawUsers
    .map((user) => sanitizeAdminUser(user))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { users }, { page: pageNum, limit: limitNum, total, pages });
};

export const getAdminUserById = async (req: Request, res: Response): Promise<void> => {
  const targetId = String(req.params.id);
  const rawUser = await User.findOne({ _id: targetId, isDeleted: false })
    .select(SAFE_USER_PROJECTION)
    .lean();

  if (!rawUser) {
    sendError(res, 404, 'User account not found', { code: 'USER_NOT_FOUND' });
    return;
  }

  const user = sanitizeAdminUser(rawUser);
  const targetObjectId = new mongoose.Types.ObjectId(targetId);

  let roleSummary: Record<string, unknown> = {};
  if (rawUser.role === 'seeker') {
    const [profile, applicationsCount, resumesCount] = await Promise.all([
      Profile.findOne({ user: targetObjectId })
        .select('headline bio location availability skills experience education linkedinUrl githubUrl portfolioUrl updatedAt')
        .lean(),
      Application.countDocuments({ seeker: targetObjectId, isDeleted: false }),
      Resume.countDocuments({ user: targetObjectId, isDeleted: false }),
    ]);

    roleSummary = {
      type: 'seeker',
      profile: profile
        ? {
            headline: profile.headline,
            bio: profile.bio,
            location: profile.location,
            availability: profile.availability,
            skillsCount: Array.isArray(profile.skills) ? profile.skills.length : 0,
            experienceCount: Array.isArray(profile.experience) ? profile.experience.length : 0,
            educationCount: Array.isArray(profile.education) ? profile.education.length : 0,
            linkedinUrl: profile.linkedinUrl,
            githubUrl: profile.githubUrl,
            portfolioUrl: profile.portfolioUrl,
            updatedAt: profile.updatedAt,
          }
        : null,
      applicationsCount,
      resumesCount,
    };
  } else if (rawUser.role === 'employer') {
    const [organization, totalJobs, activeJobs] = await Promise.all([
      Organization.findOne({ owner: targetObjectId, type: 'employer', isDeleted: false }).lean(),
      Job.countDocuments({ employer: targetObjectId, isDeleted: false }),
      Job.countDocuments({ employer: targetObjectId, isDeleted: false, status: 'active' }),
    ]);

    roleSummary = {
      type: 'employer',
      organization: organization
        ? { ...organization, verificationStatus: resolveVerificationStatus(organization) }
        : null,
      totalJobs,
      activeJobs,
    };
  } else if (rawUser.role === 'provider') {
    const [organization, totalCourses, publishedCourses] = await Promise.all([
      Organization.findOne({
        owner: targetObjectId,
        type: 'training-provider',
        isDeleted: false,
      }).lean(),
      Course.countDocuments({ provider: targetObjectId, isDeleted: false }),
      Course.countDocuments({ provider: targetObjectId, isDeleted: false, status: 'published' }),
    ]);

    roleSummary = {
      type: 'provider',
      organization: organization
        ? { ...organization, verificationStatus: resolveVerificationStatus(organization) }
        : null,
      totalCourses,
      publishedCourses,
    };
  } else {
    roleSummary = { type: 'admin' };
  }

  const activityLogs = await AuditLog.find({
    $or: [{ actor: targetObjectId }, { resourceId: targetObjectId }],
  })
    .populate('actor', 'name email role')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  sendSuccess(res, 200, {
    user,
    roleSummary,
    activities: activityLogs.map((log) => formatAdminAuditEntry(log)),
  });
};

export const updateAdminUserStatus = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.userId;
  if (!actorUserId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const targetId = String(req.params.id);
  const { isActive, reason } = req.body as UpdateUserStatusInput;

  const targetUser = await User.findById(targetId).select(SAFE_USER_PROJECTION);
  if (!targetUser) {
    sendError(res, 404, 'User account not found', { code: 'USER_NOT_FOUND' });
    return;
  }

  const protectionCheck = isProtectedAdminTarget(targetUser, actorUserId);
  if (protectionCheck.blocked) {
    sendError(res, protectionCheck.statusCode, protectionCheck.message, {
      code: protectionCheck.code,
    });
    return;
  }

  const previousIsActive = targetUser.isActive;
  targetUser.isActive = isActive;

  if (!isActive) {
    targetUser.suspensionReason = reason;
    targetUser.suspendedAt = new Date();
    targetUser.suspendedBy = new mongoose.Types.ObjectId(actorUserId);
  } else {
    targetUser.suspensionReason = undefined;
    targetUser.suspendedAt = undefined;
    targetUser.suspendedBy = undefined;
  }

  await targetUser.save();

  await recordAdminAudit({
    actorId: actorUserId,
    action: isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_SUSPENDED',
    resource: 'User',
    resourceId: targetUser._id as mongoose.Types.ObjectId,
    changes: {
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      previousIsActive,
      isActive,
      ...(reason ? { reason } : {}),
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: 200,
  });

  await notifyByAdmin({
    recipientId: targetUser._id as mongoose.Types.ObjectId,
    title: isActive ? 'Account Reinstated' : 'Account Suspended',
    message: isActive
      ? 'Your SkillOrbit AI account has been reactivated by platform administration.'
      : `Your SkillOrbit AI account has been suspended. Reason: ${reason ?? 'Policy review'}`,
    relatedId: targetUser._id as mongoose.Types.ObjectId,
  });

  sendSuccess(
    res,
    200,
    { user: sanitizeAdminUser(targetUser.toObject()) },
    isActive ? 'User account activated successfully' : 'User account suspended successfully'
  );
};

async function listPartnersByRole(
  req: Request,
  res: Response,
  config: {
    role: 'employer' | 'provider';
    orgType: OrganizationType;
    responseKey: 'employers' | 'providers';
  }
): Promise<void> {
  const {
    q,
    accountStatus = 'all',
    verificationStatus = 'all',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const userFilter: FilterQuery<IUser> = {
    role: config.role,
    isDeleted: false,
  };

  if (accountStatus === 'active') {
    userFilter.isActive = true;
  } else if (accountStatus === 'suspended') {
    userFilter.isActive = false;
  }

  if (verificationStatus === 'verified') {
    const verifiedOrgs = await Organization.find({
      type: config.orgType,
      isDeleted: false,
      $or: [{ isVerified: true }, { verificationStatus: 'verified' }],
    })
      .select('owner')
      .lean();
    userFilter._id = { $in: verifiedOrgs.map((org) => org.owner) };
  } else if (verificationStatus === 'rejected') {
    const rejectedOrgs = await Organization.find({
      type: config.orgType,
      isDeleted: false,
      verificationStatus: 'rejected',
    })
      .select('owner')
      .lean();
    userFilter._id = { $in: rejectedOrgs.map((org) => org.owner) };
  } else if (verificationStatus === 'pending') {
    const nonPendingOrgs = await Organization.find({
      type: config.orgType,
      isDeleted: false,
      $or: [
        { isVerified: true },
        { verificationStatus: 'verified' },
        { verificationStatus: 'rejected' },
      ],
    })
      .select('owner')
      .lean();
    const excludedIds = nonPendingOrgs.map((org) => org.owner);
    if (excludedIds.length > 0) {
      userFilter._id = { $nin: excludedIds };
    }
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const matchingOrgs = await Organization.find({
      type: config.orgType,
      isDeleted: false,
      $or: [
        { name: regex },
        { industry: regex },
        { location: regex },
        { specialization: regex },
      ],
    })
      .select('owner')
      .lean();
    const matchingOwnerIds = matchingOrgs.map((org) => org.owner);
    userFilter.$or = [{ name: regex }, { email: regex }, { _id: { $in: matchingOwnerIds } }];
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [usersRaw, total] = await Promise.all([
    User.find(userFilter)
      .select(SAFE_USER_PROJECTION)
      .sort(getSortOption(sort))
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(userFilter),
  ]);

  const ownerIds = usersRaw.map((user) => user._id);
  const [organizations, jobStats, courseStats] = await Promise.all([
    Organization.find({ owner: { $in: ownerIds }, type: config.orgType, isDeleted: false }).lean(),
    config.role === 'employer'
      ? Job.aggregate<{ _id: mongoose.Types.ObjectId; totalJobs: number; activeJobs: number }>([
          { $match: { employer: { $in: ownerIds }, isDeleted: false } },
          {
            $group: {
              _id: '$employer',
              totalJobs: { $sum: 1 },
              activeJobs: {
                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
              },
            },
          },
        ])
      : Promise.resolve([]),
    config.role === 'provider'
      ? Course.aggregate<{
          _id: mongoose.Types.ObjectId;
          totalCourses: number;
          publishedCourses: number;
          totalEnrollments: number;
        }>([
          { $match: { provider: { $in: ownerIds }, isDeleted: false } },
          {
            $group: {
              _id: '$provider',
              totalCourses: { $sum: 1 },
              publishedCourses: {
                $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] },
              },
              totalEnrollments: { $sum: { $ifNull: ['$enrollmentCount', 0] } },
            },
          },
        ])
      : Promise.resolve([]),
  ]);

  const orgByOwner = new Map(organizations.map((org) => [String(org.owner), org]));
  const jobStatsByOwner = new Map(jobStats.map((item) => [String(item._id), item]));
  const courseStatsByOwner = new Map(courseStats.map((item) => [String(item._id), item]));

  const items = usersRaw.map((rawUser) => {
    const safeUser = sanitizeAdminUser(rawUser);
    const org = orgByOwner.get(String(rawUser._id)) ?? null;
    const base = {
      user: safeUser,
      organization: org
        ? {
            ...org,
            verificationStatus: resolveVerificationStatus(org),
          }
        : null,
      verificationStatus: org ? resolveVerificationStatus(org) : ('pending' as const),
    };

    if (config.role === 'employer') {
      const counts = jobStatsByOwner.get(String(rawUser._id));
      return {
        ...base,
        metrics: {
          totalJobs: counts?.totalJobs ?? 0,
          activeJobs: counts?.activeJobs ?? 0,
        },
      };
    }

    const counts = courseStatsByOwner.get(String(rawUser._id));
    return {
      ...base,
      metrics: {
        totalCourses: counts?.totalCourses ?? 0,
        publishedCourses: counts?.publishedCourses ?? 0,
        totalEnrollments: counts?.totalEnrollments ?? 0,
      },
    };
  });

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { [config.responseKey]: items }, { page: pageNum, limit: limitNum, total, pages });
}

export const listAdminEmployers = async (req: Request, res: Response): Promise<void> => {
  await listPartnersByRole(req, res, {
    role: 'employer',
    orgType: 'employer',
    responseKey: 'employers',
  });
};

export const listAdminProviders = async (req: Request, res: Response): Promise<void> => {
  await listPartnersByRole(req, res, {
    role: 'provider',
    orgType: 'training-provider',
    responseKey: 'providers',
  });
};

export const getAdminEmployerById = async (req: Request, res: Response): Promise<void> => {
  const employerId = String(req.params.id);
  const rawUser = await User.findOne({ _id: employerId, role: 'employer', isDeleted: false })
    .select(SAFE_USER_PROJECTION)
    .lean();

  if (!rawUser) {
    sendError(res, 404, 'Employer account not found', { code: 'EMPLOYER_NOT_FOUND' });
    return;
  }

  const targetObjectId = new mongoose.Types.ObjectId(employerId);
  const [organization, jobs, activityLogs] = await Promise.all([
    Organization.findOne({ owner: targetObjectId, type: 'employer', isDeleted: false }).lean(),
    Job.find({ employer: targetObjectId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    AuditLog.find({
      $or: [{ actor: targetObjectId }, { resourceId: targetObjectId }],
    })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
  ]);

  sendSuccess(res, 200, {
    employer: {
      user: sanitizeAdminUser(rawUser),
      organization: organization
        ? {
            ...organization,
            verificationStatus: resolveVerificationStatus(organization),
          }
        : null,
      jobs,
      activities: activityLogs.map((log) => formatAdminAuditEntry(log)),
    },
  });
};

export const getAdminProviderById = async (req: Request, res: Response): Promise<void> => {
  const providerId = String(req.params.id);
  const rawUser = await User.findOne({ _id: providerId, role: 'provider', isDeleted: false })
    .select(SAFE_USER_PROJECTION)
    .lean();

  if (!rawUser) {
    sendError(res, 404, 'Provider account not found', { code: 'PROVIDER_NOT_FOUND' });
    return;
  }

  const targetObjectId = new mongoose.Types.ObjectId(providerId);
  const [organization, courses, activityLogs] = await Promise.all([
    Organization.findOne({
      owner: targetObjectId,
      type: 'training-provider',
      isDeleted: false,
    }).lean(),
    Course.find({ provider: targetObjectId, isDeleted: false })
      .select('-enrollments')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    AuditLog.find({
      $or: [{ actor: targetObjectId }, { resourceId: targetObjectId }],
    })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
  ]);

  sendSuccess(res, 200, {
    provider: {
      user: sanitizeAdminUser(rawUser),
      organization: organization
        ? {
            ...organization,
            verificationStatus: resolveVerificationStatus(organization),
          }
        : null,
      courses,
      activities: activityLogs.map((log) => formatAdminAuditEntry(log)),
    },
  });
};

export const getAdminAiHealth = async (req: Request, res: Response): Promise<void> => {
  const verifyConnection = req.query.verify === 'true';
  const ai = await aiHealthService.checkHealth({ verifyConnection });
  sendSuccess(res, 200, { ai });
};
