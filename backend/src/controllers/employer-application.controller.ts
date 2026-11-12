import { type Request, type Response } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import { Application, type ApplicationStatus, type IApplication } from '../models/Application.model.js';
import { Job } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Profile } from '../models/Profile.model.js';
import { User } from '../models/user.model.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import { escapeRegex, recordEmployerAudit } from '../utils/employer.util.js';
import type {
  UpdateApplicationNoteInput,
  UpdateApplicationStatusInput,
} from '../validators/employer.validator.js';

const STATUS_MESSAGES: Record<Exclude<ApplicationStatus, 'withdrawn'>, string> = {
  pending: 'moved back to pending review',
  reviewed: 'reviewed by the hiring team',
  shortlisted: 'shortlisted for next steps',
  accepted: 'accepted',
  rejected: 'not selected for this role',
};

async function findOwnedApplicationOrFail(
  applicationId: string,
  userId: string,
  res: Response
): Promise<{ application: IApplication; jobTitle: string } | null> {
  const application = await Application.findById(applicationId).populate({
    path: 'job',
    select: 'title employer isDeleted',
  });

  if (!application) {
    sendError(res, 404, 'Application not found', { code: 'APPLICATION_NOT_FOUND' });
    return null;
  }

  const jobDoc = application.job as unknown as {
    _id: mongoose.Types.ObjectId;
    title: string;
    employer: mongoose.Types.ObjectId;
    isDeleted?: boolean;
  } | null;

  if (!jobDoc || jobDoc.isDeleted) {
    sendError(res, 404, 'Associated job posting not found', { code: 'JOB_NOT_FOUND' });
    return null;
  }

  if (String(jobDoc.employer) !== String(userId)) {
    sendError(res, 403, 'Access denied — you do not own this job application', {
      code: 'FORBIDDEN',
    });
    return null;
  }

  return { application, jobTitle: jobDoc.title };
}

export const getEmployerApplications = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const {
    jobId,
    status = 'all',
    q,
    page = 1,
    limit = 10,
    sort = 'newest',
  } = req.query as Record<string, unknown>;

  const employerJobs = await Job.find({ employer: userId, isDeleted: false })
    .select('_id title status')
    .sort({ createdAt: -1 })
    .lean();

  const employerJobIds = employerJobs.map((j) => j._id);
  if (employerJobIds.length === 0) {
    sendPaginated(
      res,
      200,
      {
        applications: [],
        jobs: [],
        statusCounts: { all: 0, pending: 0, reviewed: 0, shortlisted: 0, accepted: 0, rejected: 0, withdrawn: 0 },
      },
      { page: 1, limit: Number(limit) || 10, total: 0, pages: 1 }
    );
    return;
  }

  let scopedJobIds = employerJobIds;
  if (typeof jobId === 'string' && jobId.length > 0) {
    const ownedJob = employerJobs.find((j) => String(j._id) === jobId);
    if (!ownedJob) {
      const existsElsewhere = await Job.exists({ _id: jobId, isDeleted: false });
      sendError(
        res,
        existsElsewhere ? 403 : 404,
        existsElsewhere ? 'Access denied — you do not own this job posting' : 'Job not found',
        { code: existsElsewhere ? 'FORBIDDEN' : 'JOB_NOT_FOUND' }
      );
      return;
    }
    scopedJobIds = [ownedJob._id];
  }

  const baseFilter: FilterQuery<IApplication> = {
    job: { $in: scopedJobIds },
  };

  const filter: FilterQuery<IApplication> = { ...baseFilter };

  if (typeof status === 'string' && status !== 'all') {
    filter.status = status as ApplicationStatus;
  }

  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const [matchingSeekers, matchingProfileSeekers] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }] })
        .select('_id')
        .lean(),
      Profile.find({ $or: [{ headline: regex }, { location: regex }, { skills: regex }] })
        .select('user')
        .lean(),
    ]);

    const matchingSeekerIds = [
      ...matchingSeekers.map((u) => u._id),
      ...matchingProfileSeekers.map((p) => p.user),
    ];

    const matchingEmployerJobIds = employerJobs
      .filter((j) => regex.test(j.title))
      .map((j) => j._id);

    filter.$or = [
      { seeker: { $in: matchingSeekerIds } },
      { job: { $in: matchingEmployerJobIds } },
    ];
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'match_desc') {
    sortOption = { aiMatchScore: -1, createdAt: -1 };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [total, applications, statusBuckets] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .populate('seeker', 'name email')
      .populate('job', 'title location locationType type status')
      .populate('resume', 'fileName fileSize mimeType')
      .populate('statusHistory.changedBy', 'name role')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Application.aggregate<{ _id: ApplicationStatus; count: number }>([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const seekerIds = applications
    .map((a) => (a.seeker as unknown as { _id?: mongoose.Types.ObjectId } | null)?._id)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

  const profiles = seekerIds.length
    ? await Profile.find({ user: { $in: seekerIds } })
        .select('user headline location skills availability avatarUrl experience education')
        .lean()
    : [];

  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  const enrichedApplications = applications.map((app) => {
    const seekerObj = app.seeker as unknown as { _id?: mongoose.Types.ObjectId } | null;
    const seekerProfile = seekerObj?._id ? profileMap.get(String(seekerObj._id)) : undefined;
    return {
      ...app,
      candidateProfile: seekerProfile
        ? {
            headline: seekerProfile.headline,
            location: seekerProfile.location,
            skills: seekerProfile.skills ?? [],
            availability: seekerProfile.availability,
            avatarUrl: seekerProfile.avatarUrl,
            experienceCount: seekerProfile.experience?.length ?? 0,
            educationCount: seekerProfile.education?.length ?? 0,
          }
        : undefined,
    };
  });

  const statusCounts = {
    all: 0,
    pending: 0,
    reviewed: 0,
    shortlisted: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
  };
  for (const bucket of statusBuckets) {
    statusCounts[bucket._id] = bucket.count;
    statusCounts.all += bucket.count;
  }

  const pages = Math.ceil(total / limitNum) || 1;
  sendPaginated(
    res,
    200,
    { applications: enrichedApplications, jobs: employerJobs, statusCounts },
    { page: pageNum, limit: limitNum, total, pages }
  );
};

export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const id = String(req.params.id);
  const result = await findOwnedApplicationOrFail(id, userId, res);
  if (!result) return;

  const { application, jobTitle } = result;
  if (application.status === 'withdrawn') {
    sendError(res, 400, 'Cannot update an application that has been withdrawn by the candidate', {
      code: 'CANNOT_MODIFY_WITHDRAWN',
    });
    return;
  }

  const { status, employerNote } = req.body as UpdateApplicationStatusInput;

  application.status = status;
  if (employerNote !== undefined) {
    application.employerNote = employerNote;
  }
  application.statusHistory.push({
    status,
    changedBy: new mongoose.Types.ObjectId(userId),
    note: employerNote,
    changedAt: new Date(),
  });

  await application.save();

  await Promise.all([
    Notification.create({
      recipient: application.seeker,
      type: 'application_status_changed',
      title: 'Application Status Updated',
      message: `Your application for "${jobTitle}" has been ${STATUS_MESSAGES[status]}.`,
      link: '/seeker/applications',
      metadata: { applicationId: application._id, jobId: application.job, status },
    }),
    recordEmployerAudit({
      actorId: userId,
      action: 'APPLICATION_STATUS_UPDATED',
      resource: 'Application',
      resourceId: application._id as mongoose.Types.ObjectId,
      changes: { status, jobTitle },
      statusCode: 200,
    }),
  ]);

  const updated = await Application.findById(application._id)
    .populate('seeker', 'name email')
    .populate('job', 'title location locationType type status organization')
    .populate('resume', 'fileName fileSize mimeType')
    .populate('statusHistory.changedBy', 'name role')
    .lean();

  sendSuccess(res, 200, { application: updated }, `Application marked as ${status}`);
};

export const updateApplicationNote = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const id = String(req.params.id);
  const result = await findOwnedApplicationOrFail(id, userId, res);
  if (!result) return;

  const { application } = result;
  const { employerNote } = req.body as UpdateApplicationNoteInput;

  application.employerNote = employerNote;
  await application.save();

  await recordEmployerAudit({
    actorId: userId,
    action: 'APPLICATION_NOTE_UPDATED',
    resource: 'Application',
    resourceId: application._id as mongoose.Types.ObjectId,
    statusCode: 200,
  });

  const updated = await Application.findById(application._id)
    .populate('seeker', 'name email')
    .populate('job', 'title location locationType type status organization')
    .populate('resume', 'fileName fileSize mimeType')
    .populate('statusHistory.changedBy', 'name role')
    .lean();

  sendSuccess(res, 200, { application: updated }, 'Application note updated successfully');
};
