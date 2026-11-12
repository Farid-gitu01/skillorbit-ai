import { type Request, type Response } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import { AuditLog, type IAuditLog } from '../models/AuditLog.model.js';
import { Course, type CourseStatus, type ICourse } from '../models/Course.model.js';
import { Job, type IJob, type JobStatus } from '../models/Job.model.js';
import {
  Organization,
  type IOrganization,
  type OrganizationType,
} from '../models/Organization.model.js';
import { User } from '../models/user.model.js';
import {
  escapeRegex,
  formatAdminAuditEntry,
  notifyByAdmin,
  recordAdminAudit,
  resolveVerificationStatus,
  sanitizeAdminUser,
} from '../utils/admin.util.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import type {
  ModerateCourseInput,
  ModerateJobInput,
  ReviewVerificationInput,
} from '../validators/admin.validator.js';

function getSortByCreatedOrName(sort: unknown, popularityField?: 'applicantCount' | 'enrollmentCount'): Record<string, 1 | -1> {
  if (sort === 'oldest') return { createdAt: 1 };
  if (sort === 'name') return { name: 1, createdAt: -1 };
  if (sort === 'applicants' && popularityField === 'applicantCount') {
    return { applicantCount: -1, createdAt: -1 };
  }
  if (sort === 'enrollments' && popularityField === 'enrollmentCount') {
    return { enrollmentCount: -1, createdAt: -1 };
  }
  return { createdAt: -1 };
}

export const listAdminVerifications = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    type = 'all',
    status = 'pending',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<IOrganization> = { isDeleted: false };

  if (typeof type === 'string' && type !== 'all') {
    filter.type = type as OrganizationType;
  }

  if (status === 'verified') {
    filter.$or = [{ isVerified: true }, { verificationStatus: 'verified' }];
  } else if (status === 'rejected') {
    filter.verificationStatus = 'rejected';
  } else if (status === 'pending') {
    filter.isVerified = false;
    filter.verificationStatus = { $ne: 'rejected' };
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const matchingOwners = await User.find({
      isDeleted: false,
      $or: [{ name: regex }, { email: regex }],
    })
      .select('_id')
      .lean();
    const matchingOwnerIds = matchingOwners.map((user) => user._id);

    const searchConditions: FilterQuery<IOrganization>[] = [
      { name: regex },
      { industry: regex },
      { location: regex },
      { specialization: regex },
      { owner: { $in: matchingOwnerIds } },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [orgsRaw, total] = await Promise.all([
    Organization.find(filter)
      .populate('owner', 'name email role isActive isEmailVerified createdAt')
      .sort(getSortByCreatedOrName(sort))
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Organization.countDocuments(filter),
  ]);

  const organizations = orgsRaw.map((org) => ({
    ...org,
    verificationStatus: resolveVerificationStatus(org),
    owner: sanitizeAdminUser(org.owner),
  }));

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { organizations }, { page: pageNum, limit: limitNum, total, pages });
};

export const reviewAdminVerification = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.userId;
  if (!actorUserId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const orgId = String(req.params.orgId);
  const { status, reason } = req.body as ReviewVerificationInput;

  const organization = await Organization.findOne({ _id: orgId, isDeleted: false });
  if (!organization) {
    sendError(res, 404, 'Organization record not found', { code: 'ORGANIZATION_NOT_FOUND' });
    return;
  }

  const previousStatus = resolveVerificationStatus(organization);
  const now = new Date();
  const actorObjectId = new mongoose.Types.ObjectId(actorUserId);

  organization.isVerified = status === 'verified';
  organization.verificationStatus = status;
  organization.verificationReason = reason;
  organization.verifiedBy = actorObjectId;
  organization.verifiedAt = now;

  if (!Array.isArray(organization.verificationHistory)) {
    organization.verificationHistory = [];
  }
  organization.verificationHistory.push({
    status,
    reason,
    changedBy: actorObjectId,
    changedAt: now,
  });

  await organization.save();

  await recordAdminAudit({
    actorId: actorUserId,
    action: status === 'verified' ? 'ADMIN_ORGANIZATION_VERIFIED' : 'ADMIN_ORGANIZATION_REJECTED',
    resource: 'Organization',
    resourceId: organization._id as mongoose.Types.ObjectId,
    changes: {
      organizationName: organization.name,
      organizationType: organization.type,
      previousStatus,
      verificationStatus: status,
      reason,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: 200,
  });

  const portalLink =
    organization.type === 'training-provider' ? '/provider/profile' : '/employer/organization';

  await notifyByAdmin({
    recipientId: organization.owner,
    title:
      status === 'verified'
        ? `${organization.name} Verified`
        : `Verification Update for ${organization.name}`,
    message:
      status === 'verified'
        ? `Your organization "${organization.name}" has been verified by platform administration. Note: ${reason}`
        : `Verification for "${organization.name}" was rejected. Reason: ${reason}`,
    link: portalLink,
    relatedId: organization._id as mongoose.Types.ObjectId,
  });

  const populatedOrg = await Organization.findById(organization._id)
    .populate('owner', 'name email role isActive isEmailVerified')
    .lean();

  sendSuccess(
    res,
    200,
    {
      organization: populatedOrg
        ? {
            ...populatedOrg,
            verificationStatus: resolveVerificationStatus(populatedOrg),
            owner: sanitizeAdminUser(populatedOrg.owner),
          }
        : null,
    },
    status === 'verified'
      ? 'Organization verified successfully'
      : 'Organization verification rejected'
  );
};

export const listAdminJobs = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    status = 'all',
    moderationStatus = 'all',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<IJob> = { isDeleted: false };

  if (typeof status === 'string' && status !== 'all') {
    filter.status = status as JobStatus;
  }

  if (typeof moderationStatus === 'string' && moderationStatus !== 'all') {
    if (moderationStatus === 'approved') {
      filter.$or = [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }];
    } else {
      filter.moderationStatus = moderationStatus as 'flagged' | 'rejected';
    }
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const searchConditions: FilterQuery<IJob>[] = [
      { title: regex },
      { location: regex },
      { description: regex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [jobsRaw, total] = await Promise.all([
    Job.find(filter)
      .populate('employer', 'name email role isActive')
      .populate('organization', 'name logoUrl location isVerified verificationStatus')
      .populate('skills', 'name')
      .sort(getSortByCreatedOrName(sort, 'applicantCount'))
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Job.countDocuments(filter),
  ]);

  const jobs = jobsRaw.map((job) => ({
    ...job,
    moderationStatus: job.moderationStatus ?? 'approved',
    employer: sanitizeAdminUser(job.employer),
  }));

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { jobs }, { page: pageNum, limit: limitNum, total, pages });
};

export const getAdminJobById = async (req: Request, res: Response): Promise<void> => {
  const job = await Job.findOne({ _id: String(req.params.id), isDeleted: false })
    .populate('employer', 'name email role isActive isEmailVerified')
    .populate('organization', 'name logoUrl location industry size websiteUrl isVerified verificationStatus')
    .populate('skills', 'name category')
    .lean();

  if (!job) {
    sendError(res, 404, 'Job posting not found', { code: 'JOB_NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, {
    job: {
      ...job,
      moderationStatus: job.moderationStatus ?? 'approved',
      employer: sanitizeAdminUser(job.employer),
    },
  });
};

export const moderateAdminJob = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.userId;
  if (!actorUserId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const jobId = String(req.params.id);
  const { moderationStatus, status, reason } = req.body as ModerateJobInput;

  const job = await Job.findOne({ _id: jobId, isDeleted: false });
  if (!job) {
    sendError(res, 404, 'Job posting not found', { code: 'JOB_NOT_FOUND' });
    return;
  }

  const previousModerationStatus = job.moderationStatus ?? 'approved';
  const previousJobStatus = job.status;
  const now = new Date();
  const actorObjectId = new mongoose.Types.ObjectId(actorUserId);

  job.moderationStatus = moderationStatus;
  job.moderationReason = reason;
  job.moderatedBy = actorObjectId;
  job.moderatedAt = now;

  if (moderationStatus === 'rejected') {
    job.status = status && status !== 'active' ? status : 'closed';
  } else if (status) {
    job.status = status;
  }

  if (!Array.isArray(job.moderationHistory)) {
    job.moderationHistory = [];
  }
  job.moderationHistory.push({
    status: moderationStatus,
    reason,
    changedBy: actorObjectId,
    changedAt: now,
  });

  await job.save();

  await recordAdminAudit({
    actorId: actorUserId,
    action: 'ADMIN_JOB_MODERATED',
    resource: 'Job',
    resourceId: job._id as mongoose.Types.ObjectId,
    changes: {
      title: job.title,
      previousModerationStatus,
      moderationStatus,
      previousJobStatus,
      status: job.status,
      reason,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: 200,
  });

  await notifyByAdmin({
    recipientId: job.employer,
    title: `Moderation Update: ${job.title}`,
    message:
      moderationStatus === 'approved'
        ? `Your job posting "${job.title}" passed moderation review (${reason}).`
        : moderationStatus === 'flagged'
          ? `Your job posting "${job.title}" has been flagged for review: ${reason}`
          : `Your job posting "${job.title}" was rejected and closed by administration: ${reason}`,
    link: `/employer/jobs/${String(job._id)}`,
    relatedId: job._id as mongoose.Types.ObjectId,
  });

  const populatedJob = await Job.findById(job._id)
    .populate('employer', 'name email role isActive')
    .populate('organization', 'name logoUrl location isVerified verificationStatus')
    .populate('skills', 'name')
    .lean();

  sendSuccess(
    res,
    200,
    {
      job: populatedJob
        ? {
            ...populatedJob,
            moderationStatus: populatedJob.moderationStatus ?? 'approved',
            employer: sanitizeAdminUser(populatedJob.employer),
          }
        : null,
    },
    'Job moderation updated successfully'
  );
};

export const listAdminCourses = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    status = 'all',
    moderationStatus = 'all',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<ICourse> = { isDeleted: false };

  if (typeof status === 'string' && status !== 'all') {
    filter.status = status as CourseStatus;
  }

  if (typeof moderationStatus === 'string' && moderationStatus !== 'all') {
    if (moderationStatus === 'approved') {
      filter.$or = [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }];
    } else {
      filter.moderationStatus = moderationStatus as 'flagged' | 'rejected';
    }
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const searchConditions: FilterQuery<ICourse>[] = [
      { title: regex },
      { category: regex },
      { description: regex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [coursesRaw, total] = await Promise.all([
    Course.find(filter)
      .select('-enrollments')
      .populate('provider', 'name email role isActive')
      .populate('organization', 'name logoUrl location isVerified verificationStatus')
      .populate('skills', 'name')
      .sort(getSortByCreatedOrName(sort, 'enrollmentCount'))
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const courses = coursesRaw.map((course) => ({
    ...course,
    moderationStatus: course.moderationStatus ?? 'approved',
    provider: sanitizeAdminUser(course.provider),
  }));

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { courses }, { page: pageNum, limit: limitNum, total, pages });
};

export const getAdminCourseById = async (req: Request, res: Response): Promise<void> => {
  const course = await Course.findOne({ _id: String(req.params.id), isDeleted: false })
    .select('-enrollments')
    .populate('provider', 'name email role isActive isEmailVerified')
    .populate('organization', 'name logoUrl location industry websiteUrl isVerified verificationStatus')
    .populate('skills', 'name category')
    .lean();

  if (!course) {
    sendError(res, 404, 'Course offering not found', { code: 'COURSE_NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, {
    course: {
      ...course,
      moderationStatus: course.moderationStatus ?? 'approved',
      provider: sanitizeAdminUser(course.provider),
    },
  });
};

export const moderateAdminCourse = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.userId;
  if (!actorUserId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const courseId = String(req.params.id);
  const { moderationStatus, status, reason } = req.body as ModerateCourseInput;

  const course = await Course.findOne({ _id: courseId, isDeleted: false });
  if (!course) {
    sendError(res, 404, 'Course offering not found', { code: 'COURSE_NOT_FOUND' });
    return;
  }

  const previousModerationStatus = course.moderationStatus ?? 'approved';
  const previousCourseStatus = course.status;
  const now = new Date();
  const actorObjectId = new mongoose.Types.ObjectId(actorUserId);

  course.moderationStatus = moderationStatus;
  course.moderationReason = reason;
  course.moderatedBy = actorObjectId;
  course.moderatedAt = now;

  if (moderationStatus === 'rejected') {
    course.status = status && status !== 'published' ? status : 'archived';
  } else if (status) {
    course.status = status;
  }

  if (!Array.isArray(course.moderationHistory)) {
    course.moderationHistory = [];
  }
  course.moderationHistory.push({
    status: moderationStatus,
    reason,
    changedBy: actorObjectId,
    changedAt: now,
  });

  await course.save();

  await recordAdminAudit({
    actorId: actorUserId,
    action: 'ADMIN_COURSE_MODERATED',
    resource: 'Course',
    resourceId: course._id as mongoose.Types.ObjectId,
    changes: {
      title: course.title,
      previousModerationStatus,
      moderationStatus,
      previousCourseStatus,
      status: course.status,
      reason,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: 200,
  });

  await notifyByAdmin({
    recipientId: course.provider,
    title: `Moderation Update: ${course.title}`,
    message:
      moderationStatus === 'approved'
        ? `Your training offering "${course.title}" passed moderation review (${reason}).`
        : moderationStatus === 'flagged'
          ? `Your training offering "${course.title}" has been flagged for review: ${reason}`
          : `Your training offering "${course.title}" was rejected and archived by administration: ${reason}`,
    link: `/provider/courses/${String(course._id)}/edit`,
    relatedId: course._id as mongoose.Types.ObjectId,
  });

  const populatedCourse = await Course.findById(course._id)
    .select('-enrollments')
    .populate('provider', 'name email role isActive')
    .populate('organization', 'name logoUrl location isVerified verificationStatus')
    .populate('skills', 'name')
    .lean();

  sendSuccess(
    res,
    200,
    {
      course: populatedCourse
        ? {
            ...populatedCourse,
            moderationStatus: populatedCourse.moderationStatus ?? 'approved',
            provider: sanitizeAdminUser(populatedCourse.provider),
          }
        : null,
    },
    'Course moderation updated successfully'
  );
};

export const listAdminAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    actorRole = 'all',
    resource,
    action,
    page = 1,
    limit = 20,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<IAuditLog> = {};

  if (typeof actorRole === 'string' && actorRole !== 'all') {
    filter.actorRole = actorRole as IAuditLog['actorRole'];
  }

  if (typeof resource === 'string' && resource.trim().length > 0 && resource !== 'all') {
    filter.resource = new RegExp(`^${escapeRegex(resource.trim())}$`, 'i');
  }

  if (typeof action === 'string' && action.trim().length > 0) {
    filter.action = new RegExp(escapeRegex(action.trim()), 'i');
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const matchingActors = await User.find({
      isDeleted: false,
      $or: [{ name: regex }, { email: regex }],
    })
      .select('_id')
      .lean();
    const actorIds = matchingActors.map((actor) => actor._id);
    filter.$or = [{ action: regex }, { resource: regex }, { actor: { $in: actorIds } }];
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [logsRaw, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  const logs = logsRaw.map((log) => formatAdminAuditEntry(log));
  const pages = Math.max(Math.ceil(total / limitNum), 1);

  sendPaginated(res, 200, { logs }, { page: pageNum, limit: limitNum, total, pages });
};
