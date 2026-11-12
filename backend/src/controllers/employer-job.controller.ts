import { type Request, type Response } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import { Job, type IJob } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Organization } from '../models/Organization.model.js';
import { Skill } from '../models/Skill.model.js';
import { sendCreated, sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import {
  escapeRegex,
  recordEmployerAudit,
  resolveSkillIds,
} from '../utils/employer.util.js';
import type {
  CreateJobInput,
  UpdateJobInput,
  UpdateJobStatusInput,
} from '../validators/employer.validator.js';

function isBeforeTodayUtc(date: Date): boolean {
  const now = new Date();
  const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() < todayUtcStart;
}

async function findOwnedJobOrFail(
  jobId: string,
  userId: string,
  res: Response
): Promise<IJob | null> {
  const job = await Job.findOne({ _id: jobId, isDeleted: false });
  if (!job) {
    sendError(res, 404, 'Job not found', { code: 'JOB_NOT_FOUND' });
    return null;
  }
  if (String(job.employer) !== String(userId)) {
    sendError(res, 403, 'Access denied — you do not own this job posting', {
      code: 'FORBIDDEN',
    });
    return null;
  }
  return job;
}

export const searchSkills = async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const filter: Record<string, unknown> = { isActive: true };
  if (q.length > 0) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: regex }, { aliases: regex }, { category: regex }];
  }

  const skills = await Skill.find(filter)
    .select('_id name category')
    .sort({ name: 1 })
    .limit(25)
    .lean();

  sendSuccess(res, 200, { skills });
};

export const getEmployerJobs = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const {
    q,
    status = 'all',
    locationType,
    type,
    page = 1,
    limit = 10,
    sort = 'newest',
  } = req.query as Record<string, unknown>;

  const baseFilter: FilterQuery<IJob> = {
    employer: new mongoose.Types.ObjectId(userId),
    isDeleted: false,
  };

  const filter: FilterQuery<IJob> = { ...baseFilter };

  if (typeof status === 'string' && status !== 'all') {
    filter.status = status as IJob['status'];
  }
  if (typeof locationType === 'string' && locationType.length > 0) {
    filter.locationType = locationType as IJob['locationType'];
  }
  if (typeof type === 'string' && type.length > 0) {
    filter.type = type as IJob['type'];
  }
  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { location: regex }];
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'deadline') {
    sortOption = { applicationDeadline: 1, createdAt: -1 };
  } else if (sort === 'applicants') {
    sortOption = { applicantCount: -1, createdAt: -1 };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [total, jobs, statusBuckets] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .populate('organization', 'name logoUrl websiteUrl location')
      .populate('skills', 'name category')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Job.aggregate<{ _id: IJob['status']; count: number }>([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = {
    all: 0,
    active: 0,
    draft: 0,
    closed: 0,
    expired: 0,
  };
  for (const bucket of statusBuckets) {
    statusCounts[bucket._id] = bucket.count;
    statusCounts.all += bucket.count;
  }

  const pages = Math.ceil(total / limitNum) || 1;
  sendPaginated(
    res,
    200,
    { jobs, statusCounts },
    { page: pageNum, limit: limitNum, total, pages }
  );
};

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const input = req.body as CreateJobInput;

  if (
    input.applicationDeadline &&
    input.status === 'active' &&
    isBeforeTodayUtc(input.applicationDeadline)
  ) {
    sendError(res, 400, 'Application deadline cannot be in the past for active jobs', {
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'applicationDeadline', message: 'Application deadline must be today or in the future' }],
    });
    return;
  }

  const [organization, skillIds] = await Promise.all([
    Organization.findOne({ owner: userId, type: 'employer', isDeleted: false }).select('_id').lean(),
    resolveSkillIds(input.skills),
  ]);

  const job = await Job.create({
    employer: userId,
    organization: organization?._id,
    title: input.title,
    description: input.description,
    responsibilities: input.responsibilities,
    qualifications: input.qualifications,
    skills: skillIds,
    location: input.location,
    locationType: input.locationType,
    type: input.type,
    experienceLevel: input.experienceLevel,
    openings: input.openings,
    salary: input.salary,
    applicationDeadline: input.applicationDeadline,
    status: input.status,
  });

  await recordEmployerAudit({
    actorId: userId,
    action: 'JOB_CREATED',
    resource: 'Job',
    resourceId: job._id as mongoose.Types.ObjectId,
    changes: { title: job.title, status: job.status },
    statusCode: 201,
  });

  if (job.status === 'active') {
    await Notification.create({
      recipient: userId,
      type: 'job_posted',
      title: 'Job Published',
      message: `Your job posting "${job.title}" is now live and accepting applications.`,
      link: `/employer/jobs/${String(job._id)}`,
      metadata: { jobId: job._id, status: 'active' },
    });
  }

  const populatedJob = await Job.findById(job._id)
    .populate('organization', 'name logoUrl websiteUrl industry size location description')
    .populate('skills', 'name category')
    .lean();

  sendCreated(
    res,
    { job: populatedJob },
    job.status === 'active' ? 'Job published successfully' : 'Job saved as draft'
  );
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const id = String(req.params.id);
  const job = await findOwnedJobOrFail(id, userId, res);
  if (!job) return;

  const input = req.body as UpdateJobInput;
  const nextStatus = input.status ?? job.status;

  if (
    input.applicationDeadline &&
    nextStatus === 'active' &&
    job.applicationDeadline?.getTime() !== input.applicationDeadline.getTime() &&
    isBeforeTodayUtc(input.applicationDeadline)
  ) {
    sendError(res, 400, 'Application deadline cannot be in the past for active jobs', {
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'applicationDeadline', message: 'Application deadline must be today or in the future' }],
    });
    return;
  }

  const previousStatus = job.status;
  const skillIds = await resolveSkillIds(input.skills);

  if (!job.organization) {
    const org = await Organization.findOne({ owner: userId, type: 'employer', isDeleted: false })
      .select('_id')
      .lean();
    if (org) {
      job.organization = org._id as mongoose.Types.ObjectId;
    }
  }

  job.title = input.title;
  job.description = input.description;
  job.responsibilities = input.responsibilities;
  job.qualifications = input.qualifications;
  job.skills = skillIds;
  job.location = input.location;
  job.locationType = input.locationType;
  job.type = input.type;
  job.experienceLevel = input.experienceLevel;
  job.openings = input.openings;
  job.salary = input.salary;
  job.applicationDeadline = input.applicationDeadline;
  if (input.status) {
    job.status = input.status;
  }

  await job.save();

  await recordEmployerAudit({
    actorId: userId,
    action: 'JOB_UPDATED',
    resource: 'Job',
    resourceId: job._id as mongoose.Types.ObjectId,
    changes: { title: job.title, status: job.status },
    statusCode: 200,
  });

  if (previousStatus !== job.status) {
    if (job.status === 'active') {
      await Notification.create({
        recipient: userId,
        type: 'job_posted',
        title: 'Job Published',
        message: `Your job posting "${job.title}" is now live.`,
        link: `/employer/jobs/${String(job._id)}`,
        metadata: { jobId: job._id, status: 'active' },
      });
    } else if (job.status === 'closed') {
      await Notification.create({
        recipient: userId,
        type: 'system',
        title: 'Job Closed',
        message: `Your job posting "${job.title}" has been closed to new applicants.`,
        link: `/employer/jobs/${String(job._id)}`,
        metadata: { jobId: job._id, status: 'closed', category: 'job_status' },
      });
    }
  }

  const populatedJob = await Job.findById(job._id)
    .populate('organization', 'name logoUrl websiteUrl industry size location description')
    .populate('skills', 'name category')
    .lean();

  sendSuccess(res, 200, { job: populatedJob }, 'Job updated successfully');
};

export const updateJobStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const id = String(req.params.id);
  const job = await findOwnedJobOrFail(id, userId, res);
  if (!job) return;

  const { status } = req.body as UpdateJobStatusInput;
  const previousStatus = job.status;

  job.status = status;
  await job.save();

  await recordEmployerAudit({
    actorId: userId,
    action: 'JOB_STATUS_CHANGED',
    resource: 'Job',
    resourceId: job._id as mongoose.Types.ObjectId,
    changes: { title: job.title, from: previousStatus, status },
    statusCode: 200,
  });

  if (previousStatus !== status) {
    if (status === 'active') {
      await Notification.create({
        recipient: userId,
        type: 'job_posted',
        title: 'Job Published',
        message: `"${job.title}" is now active and visible to candidates.`,
        link: `/employer/jobs/${String(job._id)}`,
        metadata: { jobId: job._id, status: 'active' },
      });
    } else if (status === 'closed') {
      await Notification.create({
        recipient: userId,
        type: 'system',
        title: 'Job Closed',
        message: `"${job.title}" has been closed and is no longer accepting applications.`,
        link: `/employer/jobs/${String(job._id)}`,
        metadata: { jobId: job._id, status: 'closed', category: 'job_status' },
      });
    } else if (status === 'draft') {
      await Notification.create({
        recipient: userId,
        type: 'system',
        title: 'Job Moved to Draft',
        message: `"${job.title}" has been moved back to drafts.`,
        link: `/employer/jobs/${String(job._id)}`,
        metadata: { jobId: job._id, status: 'draft', category: 'job_status' },
      });
    }
  }

  const populatedJob = await Job.findById(job._id)
    .populate('organization', 'name logoUrl websiteUrl industry size location description')
    .populate('skills', 'name category')
    .lean();

  sendSuccess(res, 200, { job: populatedJob }, `Job status updated to ${status}`);
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const id = String(req.params.id);
  const job = await findOwnedJobOrFail(id, userId, res);
  if (!job) return;

  job.isDeleted = true;
  job.deletedAt = new Date();
  await job.save();

  await recordEmployerAudit({
    actorId: userId,
    action: 'JOB_DELETED',
    resource: 'Job',
    resourceId: job._id as mongoose.Types.ObjectId,
    changes: { title: job.title },
    statusCode: 200,
  });

  sendSuccess(res, 200, { deletedId: id }, 'Job deleted successfully');
};
