import { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.model.js';
import {
  Course,
  type CourseEngagementStatus,
  type ICourseEnrollment,
} from '../models/Course.model.js';
import { Notification } from '../models/Notification.model.js';
import { Organization } from '../models/Organization.model.js';
import { Profile } from '../models/Profile.model.js';
import { User } from '../models/user.model.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import {
  buildSafeLearnerSummary,
  calculateProviderCompletion,
  computeActiveEnrollmentCount,
  recordProviderAudit,
} from '../utils/provider.util.js';
import type {
  UpdateEngagementInput,
  UpsertProviderOrganizationInput,
} from '../validators/provider.validator.js';

interface ActivityFeedItem {
  _id: string;
  action: string;
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
}

const PROVIDER_AUDIT_LABELS: Record<
  string,
  { title: string; format: (changes?: Record<string, unknown>) => string }
> = {
  PROVIDER_PROFILE_UPDATED: {
    title: 'Provider profile updated',
    format: (changes) =>
      typeof changes?.name === 'string'
        ? `Updated training provider profile for ${changes.name}`
        : 'Updated provider profile details',
  },
  COURSE_CREATED: {
    title: 'New offering created',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Created "${changes.title}" (${String(changes?.status ?? 'draft')})`
        : 'Created a new training course offering',
  },
  COURSE_UPDATED: {
    title: 'Offering details updated',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Updated "${changes.title}"`
        : 'Updated course offering details',
  },
  COURSE_STATUS_CHANGED: {
    title: 'Offering visibility updated',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `"${changes.title}" marked as ${String(changes?.status ?? 'updated')}`
        : `Course marked as ${String(changes?.status ?? 'updated')}`,
  },
  COURSE_DELETED: {
    title: 'Offering archived & removed',
    format: (changes) =>
      typeof changes?.title === 'string'
        ? `Removed "${changes.title}"`
        : 'Removed a course offering',
  },
  ENGAGEMENT_STATUS_UPDATED: {
    title: 'Learner engagement updated',
    format: (changes) =>
      typeof changes?.status === 'string'
        ? `Updated learner engagement to ${changes.status}`
        : 'Updated learner enrollment status',
  },
  ENGAGEMENT_NOTE_UPDATED: {
    title: 'Internal learner note saved',
    format: () => 'Saved internal evaluation note on learner engagement',
  },
};

function sanitizeCourseSummaryForProvider<
  T extends { enrollments?: ICourseEnrollment[]; enrollmentCount?: number }
>(course: T): Omit<T, 'enrollments'> & {
  enrollmentCount: number;
  pendingEngagementsCount: number;
} {
  const enrollments = Array.isArray(course.enrollments) ? course.enrollments : [];
  const activeCount = computeActiveEnrollmentCount(enrollments);
  const pendingEngagementsCount = enrollments.filter((e) => e.status === 'pending').length;
  const rest = { ...course };
  delete rest.enrollments;

  return {
    ...rest,
    enrollmentCount: Math.max(course.enrollmentCount ?? 0, activeCount),
    pendingEngagementsCount,
  };
}

export async function listOwnedCourseEngagements(params: {
  userId: string;
  forcedCourseId?: string;
  query: Record<string, unknown>;
  res: Response;
}): Promise<void> {
  const { userId, forcedCourseId, query, res } = params;
  const {
    q,
    courseId,
    status = 'all',
    type = 'all',
    page = 1,
    limit = 10,
  } = query;

  const targetCourseId =
    forcedCourseId ?? (typeof courseId === 'string' && courseId.length > 0 ? courseId : undefined);

  if (targetCourseId) {
    const targetCourse = await Course.findOne({ _id: targetCourseId, isDeleted: false })
      .select('provider')
      .lean();
    if (!targetCourse) {
      sendError(res, 404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
      return;
    }
    if (String(targetCourse.provider) !== String(userId)) {
      sendError(res, 403, 'Access denied — you do not own this course', {
        code: 'FORBIDDEN',
      });
      return;
    }
  }

  const courseFilter: Record<string, unknown> = {
    provider: userId,
    isDeleted: false,
  };
  if (targetCourseId) {
    courseFilter._id = new mongoose.Types.ObjectId(targetCourseId);
  }

  const ownedCourses = await Course.find(courseFilter)
    .select('_id title level category status enrollments')
    .sort({ createdAt: -1 })
    .lean();

  const rawItems: Array<{
    engagement: ICourseEnrollment;
    course: {
      _id: string;
      title: string;
      level?: string;
      category?: string;
      status: string;
    };
  }> = [];

  for (const course of ownedCourses) {
    const entries = Array.isArray(course.enrollments) ? course.enrollments : [];
    for (const engagement of entries) {
      rawItems.push({
        engagement,
        course: {
          _id: String(course._id),
          title: course.title,
          level: course.level,
          category: course.category,
          status: course.status,
        },
      });
    }
  }

  const stats = {
    total: 0,
    pending: 0,
    enrolled: 0,
    active: 0,
    completed: 0,
    declined: 0,
    enquiries: 0,
  };

  for (const { engagement } of rawItems) {
    if (engagement.status === 'withdrawn') continue;
    stats.total += 1;
    if (engagement.status === 'pending') stats.pending += 1;
    if (engagement.status === 'enrolled') stats.enrolled += 1;
    if (engagement.status === 'active') stats.active += 1;
    if (engagement.status === 'completed') stats.completed += 1;
    if (engagement.status === 'declined') stats.declined += 1;
    if (engagement.type === 'enquiry') stats.enquiries += 1;
  }

  const learnerIds = Array.from(
    new Set(rawItems.map(({ engagement }) => String(engagement.learner)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  const [users, profiles] =
    learnerIds.length > 0
      ? await Promise.all([
          User.find({ _id: { $in: learnerIds }, isDeleted: false }).select('name').lean(),
          Profile.find({ user: { $in: learnerIds } })
            .select(
              'user headline bio location avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl'
            )
            .lean(),
        ])
      : [[], []];

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  const statusFilter = typeof status === 'string' ? status : 'all';
  const typeFilter = typeof type === 'string' ? type : 'all';
  const searchNeedle = typeof q === 'string' ? q.trim().toLowerCase() : '';

  const hydrated = rawItems
    .map(({ engagement, course }) => {
      const learnerId = String(engagement.learner);
      const learnerUser = userMap.get(learnerId);
      const learnerProfile = profileMap.get(learnerId);
      const learner = buildSafeLearnerSummary(learnerId, learnerUser, learnerProfile);

      return {
        _id: String(engagement._id),
        course,
        learner,
        type: engagement.type,
        status: engagement.status,
        progress: engagement.progress ?? 0,
        learnerMessage: engagement.learnerMessage,
        providerNote: engagement.providerNote,
        statusHistory: engagement.statusHistory ?? [],
        enrolledAt: engagement.enrolledAt,
        completedAt: engagement.completedAt,
        updatedAt: engagement.updatedAt ?? engagement.enrolledAt,
      };
    })
    .filter((item) => {
      if (statusFilter === 'all') {
        if (item.status === 'withdrawn') return false;
      } else if (item.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      if (searchNeedle.length > 0) {
        const haystack = [
          item.learner.name,
          item.learner.profile.headline ?? '',
          item.learner.profile.location ?? '',
          item.course.title,
          item.learnerMessage ?? '',
          ...(item.learner.profile.skills ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchNeedle)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt ?? a.enrolledAt).getTime();
      const timeB = new Date(b.updatedAt ?? b.enrolledAt).getTime();
      return timeB - timeA;
    });

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const total = hydrated.length;
  const pages = Math.max(Math.ceil(total / limitNum), 1);
  const offset = (pageNum - 1) * limitNum;
  const engagements = hydrated.slice(offset, offset + limitNum);

  sendPaginated(
    res,
    200,
    {
      engagements,
      stats,
      courses: ownedCourses.map((c) => ({ _id: String(c._id), title: c.title })),
    },
    { page: pageNum, limit: limitNum, total, pages }
  );
}

export const getProviderDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const [user, organization, courses, recentNotifications, unreadNotificationsCount, auditLogs] =
    await Promise.all([
      User.findById(userId).select('name email role createdAt').lean(),
      Organization.findOne({
        owner: userId,
        type: 'training-provider',
        isDeleted: false,
      }).lean(),
      Course.find({ provider: userId, isDeleted: false })
        .populate('skills', 'name category')
        .sort({ createdAt: -1 })
        .lean(),
      Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ recipient: userId, read: false }),
      AuditLog.find({ actor: userId }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

  const organizationCompletion = calculateProviderCompletion(organization);

  const courseStats = {
    total: courses.length,
    published: 0,
    draft: 0,
    archived: 0,
    totalEnrollments: 0,
    averageRating: null as number | null,
  };

  let ratingSum = 0;
  let ratedCourseCount = 0;

  const engagementStats = {
    total: 0,
    pending: 0,
    enrolled: 0,
    active: 0,
    completed: 0,
    declined: 0,
    enquiries: 0,
  };

  const flattenedEngagements: Array<{
    engagement: ICourseEnrollment;
    course: { _id: string; title: string; level?: string; category?: string; status: string };
  }> = [];

  for (const course of courses) {
    if (course.status === 'published') courseStats.published += 1;
    else if (course.status === 'draft') courseStats.draft += 1;
    else if (course.status === 'archived') courseStats.archived += 1;

    const entries = Array.isArray(course.enrollments) ? course.enrollments : [];
    const activeEnrollments = computeActiveEnrollmentCount(entries);
    courseStats.totalEnrollments += Math.max(course.enrollmentCount ?? 0, activeEnrollments);

    if (typeof course.rating === 'number' && (course.ratingCount ?? 0) > 0) {
      ratingSum += course.rating;
      ratedCourseCount += 1;
    }

    for (const engagement of entries) {
      if (engagement.status === 'withdrawn') continue;
      engagementStats.total += 1;
      if (engagement.status === 'pending') engagementStats.pending += 1;
      if (engagement.status === 'enrolled') engagementStats.enrolled += 1;
      if (engagement.status === 'active') engagementStats.active += 1;
      if (engagement.status === 'completed') engagementStats.completed += 1;
      if (engagement.status === 'declined') engagementStats.declined += 1;
      if (engagement.type === 'enquiry') engagementStats.enquiries += 1;

      flattenedEngagements.push({
        engagement,
        course: {
          _id: String(course._id),
          title: course.title,
          level: course.level,
          category: course.category,
          status: course.status,
        },
      });
    }
  }

  if (ratedCourseCount > 0) {
    courseStats.averageRating = Number((ratingSum / ratedCourseCount).toFixed(1));
  }

  const topEngagements = flattenedEngagements
    .sort((a, b) => {
      const timeA = new Date(a.engagement.updatedAt ?? a.engagement.enrolledAt).getTime();
      const timeB = new Date(b.engagement.updatedAt ?? b.engagement.enrolledAt).getTime();
      return timeB - timeA;
    })
    .slice(0, 5);

  const topLearnerIds = Array.from(
    new Set(topEngagements.map((item) => String(item.engagement.learner)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  const [learnerUsers, learnerProfiles] =
    topLearnerIds.length > 0
      ? await Promise.all([
          User.find({ _id: { $in: topLearnerIds }, isDeleted: false }).select('name').lean(),
          Profile.find({ user: { $in: topLearnerIds } })
            .select('user headline location avatarUrl skills availability')
            .lean(),
        ])
      : [[], []];

  const userMap = new Map(learnerUsers.map((u) => [String(u._id), u]));
  const profileMap = new Map(learnerProfiles.map((p) => [String(p.user), p]));

  const recentEngagements = topEngagements.map(({ engagement, course }) => {
    const learnerId = String(engagement.learner);
    return {
      _id: String(engagement._id),
      course,
      learner: buildSafeLearnerSummary(learnerId, userMap.get(learnerId), profileMap.get(learnerId)),
      type: engagement.type,
      status: engagement.status,
      progress: engagement.progress ?? 0,
      learnerMessage: engagement.learnerMessage,
      enrolledAt: engagement.enrolledAt,
      updatedAt: engagement.updatedAt ?? engagement.enrolledAt,
    };
  });

  const recentCourses = courses.slice(0, 5).map(sanitizeCourseSummaryForProvider);

  const recentActivity: ActivityFeedItem[] = auditLogs.map((log) => {
    const meta = PROVIDER_AUDIT_LABELS[log.action];
    const resourceId = log.resourceId ? String(log.resourceId) : '';
    let link: string | undefined;

    if (log.resource === 'Organization') {
      link = '/provider/profile';
    } else if (log.resource === 'Course' && log.action !== 'COURSE_DELETED' && resourceId) {
      link = `/provider/courses/${resourceId}`;
    } else if (log.resource === 'Enrollment' && resourceId) {
      link = `/provider/engagements/${resourceId}`;
    }

    return {
      _id: String(log._id),
      action: log.action,
      title: meta?.title ?? log.action.replace(/_/g, ' ').toLowerCase(),
      description: meta?.format(log.changes) ?? 'Recorded provider workspace activity',
      timestamp: log.createdAt,
      link,
    };
  });

  sendSuccess(res, 200, {
    user,
    organization: organization ?? null,
    organizationCompletion,
    courseStats,
    engagementStats,
    recentCourses,
    recentEngagements,
    recentActivity,
    notifications: recentNotifications,
    unreadNotificationsCount,
  });
};

export const getMyProviderProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const organization = await Organization.findOne({
    owner: userId,
    type: 'training-provider',
    isDeleted: false,
  }).lean();

  const completion = calculateProviderCompletion(organization);

  sendSuccess(res, 200, {
    organization: organization ?? null,
    completionPercentage: completion.percentage,
    missingFields: completion.missingFields,
  });
};

export const upsertMyProviderProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const input = req.body as UpsertProviderOrganizationInput;

  const setFields: Record<string, unknown> = {
    owner: new mongoose.Types.ObjectId(userId),
    type: 'training-provider',
    name: input.name,
  };
  const unsetFields: Record<string, 1> = {};

  const optionalKeys = [
    'specialization',
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
    { owner: userId, type: 'training-provider', isDeleted: false },
    updateOp,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Backfill organization reference on provider courses created before profile setup
  await Course.updateMany(
    {
      provider: userId,
      isDeleted: false,
      $or: [{ organization: { $exists: false } }, { organization: null }],
    },
    { $set: { organization: organization._id } }
  );

  await recordProviderAudit({
    actorId: userId,
    action: 'PROVIDER_PROFILE_UPDATED',
    resource: 'Organization',
    resourceId: organization._id as mongoose.Types.ObjectId,
    changes: { name: organization.name },
    statusCode: 200,
  });

  const completion = calculateProviderCompletion(organization);

  sendSuccess(
    res,
    200,
    {
      organization,
      completionPercentage: completion.percentage,
      missingFields: completion.missingFields,
    },
    'Provider profile saved successfully'
  );
};

export const getProviderEngagements = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  await listOwnedCourseEngagements({
    userId,
    query: req.query as Record<string, unknown>,
    res,
  });
};

export const getProviderEngagementById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const engagementId = String(req.params.engagementId);

  const course = await Course.findOne({
    'enrollments._id': engagementId,
    isDeleted: false,
  })
    .populate('organization', 'name logoUrl location')
    .lean();

  if (!course) {
    sendError(res, 404, 'Learner engagement record not found', { code: 'ENGAGEMENT_NOT_FOUND' });
    return;
  }

  if (String(course.provider) !== String(userId)) {
    sendError(res, 403, 'Access denied — you do not own this course engagement', {
      code: 'FORBIDDEN',
    });
    return;
  }

  const engagement = course.enrollments.find((item) => String(item._id) === engagementId);
  if (!engagement) {
    sendError(res, 404, 'Learner engagement record not found', { code: 'ENGAGEMENT_NOT_FOUND' });
    return;
  }

  const learnerId = String(engagement.learner);
  const [learnerUser, learnerProfile] = await Promise.all([
    User.findOne({ _id: learnerId, isDeleted: false }).select('name').lean(),
    Profile.findOne({ user: learnerId })
      .select(
        'user headline bio location avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl'
      )
      .lean(),
  ]);

  sendSuccess(res, 200, {
    engagement: {
      _id: String(engagement._id),
      course: {
        _id: String(course._id),
        title: course.title,
        level: course.level,
        category: course.category,
        deliveryMode: course.deliveryMode,
        status: course.status,
      },
      learner: buildSafeLearnerSummary(learnerId, learnerUser ?? undefined, learnerProfile ?? undefined),
      type: engagement.type,
      status: engagement.status,
      progress: engagement.progress ?? 0,
      learnerMessage: engagement.learnerMessage,
      providerNote: engagement.providerNote,
      statusHistory: engagement.statusHistory ?? [],
      enrolledAt: engagement.enrolledAt,
      completedAt: engagement.completedAt,
      updatedAt: engagement.updatedAt ?? engagement.enrolledAt,
    },
  });
};

export const updateProviderEngagement = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const engagementId = String(req.params.engagementId);
  const { status, progress, providerNote, note } = req.body as UpdateEngagementInput;

  const course = await Course.findOne({
    'enrollments._id': engagementId,
    isDeleted: false,
  });

  if (!course) {
    sendError(res, 404, 'Learner engagement record not found', { code: 'ENGAGEMENT_NOT_FOUND' });
    return;
  }

  if (String(course.provider) !== String(userId)) {
    sendError(res, 403, 'Access denied — you do not own this course engagement', {
      code: 'FORBIDDEN',
    });
    return;
  }

  const engagementIndex = course.enrollments.findIndex((item) => String(item._id) === engagementId);
  if (engagementIndex === -1) {
    sendError(res, 404, 'Learner engagement record not found', { code: 'ENGAGEMENT_NOT_FOUND' });
    return;
  }

  const entry = course.enrollments[engagementIndex];
  if (entry.status === 'withdrawn') {
    sendError(res, 400, 'Cannot modify an engagement that was withdrawn by the learner', {
      code: 'INVALID_STATUS_TRANSITION',
    });
    return;
  }

  const previousStatus = entry.status;
  let statusChanged = false;

  if (status !== undefined && status !== previousStatus) {
    entry.status = status as CourseEngagementStatus;
    statusChanged = true;

    if (status === 'completed') {
      entry.completedAt = new Date();
      if (progress === undefined && (entry.progress ?? 0) < 100) {
        entry.progress = 100;
      }
    }

    entry.statusHistory.push({
      status: entry.status,
      changedBy: new mongoose.Types.ObjectId(userId),
      note: note ?? providerNote,
      changedAt: new Date(),
    });
  } else if (note !== undefined && note.trim().length > 0) {
    entry.statusHistory.push({
      status: entry.status,
      changedBy: new mongoose.Types.ObjectId(userId),
      note: note.trim(),
      changedAt: new Date(),
    });
  }

  if (progress !== undefined) {
    entry.progress = progress;
    if (progress === 100 && entry.status === 'active') {
      entry.completedAt = entry.completedAt ?? new Date();
    }
  }

  if (providerNote !== undefined) {
    entry.providerNote = providerNote;
  }

  entry.updatedAt = new Date();
  course.enrollmentCount = computeActiveEnrollmentCount(course.enrollments);
  await course.save();

  if (statusChanged) {
    const statusLabelMap: Record<string, string> = {
      pending: 'Pending Review',
      enrolled: 'Confirmed Enrollment',
      active: 'In Progress',
      completed: 'Completed',
      declined: 'Declined',
    };

    try {
      await Notification.create({
        recipient: entry.learner,
        type: entry.status === 'completed' ? 'course_completed' : 'course_enrollment',
        title: `Course status updated: ${course.title}`,
        message: `Your status for "${course.title}" has been updated to ${
          statusLabelMap[entry.status] ?? entry.status
        }.`,
        link: `/seeker/courses/${course._id}`,
        metadata: {
          courseId: course._id,
          engagementId: entry._id,
          status: entry.status,
        },
      });
    } catch {
      // Non-critical notification failure must not break status update
    }
  }

  await recordProviderAudit({
    actorId: userId,
    action: statusChanged ? 'ENGAGEMENT_STATUS_UPDATED' : 'ENGAGEMENT_NOTE_UPDATED',
    resource: 'Enrollment',
    resourceId: engagementId,
    changes: {
      courseTitle: course.title,
      previousStatus,
      status: entry.status,
      progress: entry.progress,
    },
    statusCode: 200,
  });

  const learnerId = String(entry.learner);
  const [learnerUser, learnerProfile] = await Promise.all([
    User.findOne({ _id: learnerId, isDeleted: false }).select('name').lean(),
    Profile.findOne({ user: learnerId })
      .select(
        'user headline bio location avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl'
      )
      .lean(),
  ]);

  sendSuccess(
    res,
    200,
    {
      engagement: {
        _id: String(entry._id),
        course: {
          _id: String(course._id),
          title: course.title,
          level: course.level,
          category: course.category,
          deliveryMode: course.deliveryMode,
          status: course.status,
        },
        learner: buildSafeLearnerSummary(learnerId, learnerUser ?? undefined, learnerProfile ?? undefined),
        type: entry.type,
        status: entry.status,
        progress: entry.progress ?? 0,
        learnerMessage: entry.learnerMessage,
        providerNote: entry.providerNote,
        statusHistory: entry.statusHistory ?? [],
        enrolledAt: entry.enrolledAt,
        completedAt: entry.completedAt,
        updatedAt: entry.updatedAt,
      },
    },
    statusChanged ? 'Learner engagement updated successfully' : 'Internal note & progress saved'
  );
};
