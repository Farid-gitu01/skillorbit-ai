import { type Request, type Response } from 'express';
import { Application } from '../models/Application.model.js';
import { Job } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Profile } from '../models/Profile.model.js';
import { Resume } from '../models/Resume.model.js';
import { sendCreated, sendError, sendSuccess } from '../utils/api-response.util.js';

export const applyForJob = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const { jobId, resumeId, coverLetter } = req.body;

  const job = await Job.findOne({ _id: jobId, isDeleted: false, status: 'active' })
    .populate('organization', 'name');

  if (!job) {
    sendError(res, 404, 'Job listing not found or is no longer active', { code: 'JOB_NOT_FOUND' });
    return;
  }

  // Check existing application
  const existingApp = await Application.findOne({ seeker: userId, job: jobId });
  if (existingApp) {
    sendError(res, 409, 'You have already applied for this job', { code: 'DUPLICATE_APPLICATION' });
    return;
  }

  // Verify resume ownership if provided
  let validResumeId = resumeId;
  if (validResumeId) {
    const resume = await Resume.findOne({ _id: validResumeId, user: userId });
    if (!resume) {
      sendError(res, 400, 'Invalid resume selected', { code: 'INVALID_RESUME' });
      return;
    }
  } else {
    // Pick primary resume if available
    const primaryResume = await Resume.findOne({ user: userId, isPrimary: true });
    if (primaryResume) {
      validResumeId = primaryResume._id;
    }
  }

  // Calculate simple match score from profile skills
  let aiMatchScore = 75; // default baseline
  const profile = await Profile.findOne({ user: userId }).select('skills');
  if (profile?.skills?.length && job.skills?.length) {
    const profileSkillsLower = new Set(profile.skills.map((s) => s.toLowerCase()));
    const jobSkills = await Job.findById(jobId).populate('skills', 'name');
    const matched: string[] = [];
    const missing: string[] = [];

    if (jobSkills && Array.isArray(jobSkills.skills)) {
      const populatedSkills = jobSkills.skills as unknown as Array<{ name?: string }>;
      for (const skillObj of populatedSkills) {
        if (skillObj?.name && profileSkillsLower.has(skillObj.name.toLowerCase())) {
          matched.push(skillObj.name);
        } else if (skillObj?.name) {
          missing.push(skillObj.name);
        }
      }
      if (matched.length + missing.length > 0) {
        aiMatchScore = Math.round((matched.length / (matched.length + missing.length)) * 100);
      }
    }
  }

  const application = await Application.create({
    seeker: userId,
    job: jobId,
    resume: validResumeId,
    coverLetter,
    status: 'pending',
    aiMatchScore,
    aiMatchDetails: {
      matchedSkills: profile?.skills ?? [],
      missingSkills: [],
      experienceMatch: true,
      summary: `Application submitted with ${aiMatchScore}% estimated profile fit.`,
    },
    statusHistory: [
      {
        status: 'pending',
        changedBy: userId,
        changedAt: new Date(),
      },
    ],
  });

  // Increment applicant count on job
  await Job.findByIdAndUpdate(jobId, { $inc: { applicantCount: 1 } });

  // Create notifications for seeker and job employer
  await Promise.all([
    Notification.create({
      recipient: userId,
      type: 'application_submitted',
      title: 'Application Submitted',
      message: `Your application for "${job.title}" has been successfully submitted.`,
      link: `/seeker/applications`,
    }),
    Notification.create({
      recipient: job.employer,
      type: 'application_submitted',
      title: 'New Application Received',
      message: `A candidate applied for "${job.title}".`,
      link: `/employer/applications/${String(application._id)}`,
      metadata: { jobId: job._id, applicationId: application._id },
    }),
  ]);

  sendCreated(res, { application }, 'Application submitted successfully');
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const { status } = req.query;
  const filter: Record<string, unknown> = { seeker: userId };
  if (status && typeof status === 'string' && status !== 'all') {
    filter.status = status;
  }

  const applications = await Application.find(filter)
    .populate({
      path: 'job',
      select: 'title location locationType type salary status applicationDeadline organization employer',
      populate: { path: 'organization', select: 'name logo' },
    })
    .populate('resume', 'fileName fileUrl fileSize')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 200, { applications });
};

export const getApplicationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const application = await Application.findById(id)
    .populate({
      path: 'job',
      populate: [
        { path: 'organization', select: 'name logo logoUrl website websiteUrl industry' },
        { path: 'skills', select: 'name category' },
      ],
    })
    .populate('resume', 'fileName fileUrl fileSize mimeType')
    .populate('seeker', 'name email')
    .populate('statusHistory.changedBy', 'name role')
    .lean();

  if (!application) {
    sendError(res, 404, 'Application not found', { code: 'APPLICATION_NOT_FOUND' });
    return;
  }

  const jobEmployerId = (application.job as unknown as { employer?: unknown } | null)?.employer;
  const isSeekerOwner = String((application.seeker as unknown as { _id?: unknown } | null)?._id ?? application.seeker) === String(userId);
  const isJobEmployer = req.userRole === 'employer' && Boolean(jobEmployerId) && String(jobEmployerId) === String(userId);
  const isAdmin = req.userRole === 'admin';

  if (!isSeekerOwner && !isJobEmployer && !isAdmin) {
    sendError(res, 403, 'Access denied', { code: 'FORBIDDEN' });
    return;
  }

  let candidateProfile: Record<string, unknown> | undefined;
  if (isJobEmployer || isAdmin) {
    const seekerId = (application.seeker as unknown as { _id?: unknown } | null)?._id ?? application.seeker;
    const profile = await Profile.findOne({ user: seekerId })
      .select('headline bio location phone avatarUrl availability skills languages experience education linkedinUrl githubUrl portfolioUrl')
      .lean();
    if (profile) {
      candidateProfile = profile as unknown as Record<string, unknown>;
    }
  }

  sendSuccess(res, 200, {
    application: candidateProfile ? { ...application, candidateProfile } : application,
  });
};

export const withdrawApplication = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const application = await Application.findOne({ _id: id, seeker: userId });
  if (!application) {
    sendError(res, 404, 'Application not found', { code: 'APPLICATION_NOT_FOUND' });
    return;
  }

  if (application.status === 'withdrawn') {
    sendError(res, 400, 'Application has already been withdrawn', { code: 'ALREADY_WITHDRAWN' });
    return;
  }

  if (application.status === 'rejected' || application.status === 'accepted') {
    sendError(res, 400, `Cannot withdraw an application that has been ${application.status}`, {
      code: 'CANNOT_WITHDRAW',
    });
    return;
  }

  application.status = 'withdrawn';
  application.withdrawnAt = new Date();
  application.statusHistory.push({
    status: 'withdrawn',
    changedBy: application.seeker,
    changedAt: new Date(),
  });
  await application.save();

  // Decrement applicantCount on job and notify employer
  const job = await Job.findByIdAndUpdate(
    application.job,
    { $inc: { applicantCount: -1 } },
    { new: true }
  ).select('employer title');

  if (job?.employer) {
    await Notification.create({
      recipient: job.employer,
      type: 'application_status_changed',
      title: 'Application Withdrawn',
      message: `A candidate withdrew their application for "${job.title}".`,
      link: '/employer/applications',
      metadata: { jobId: job._id, applicationId: application._id, status: 'withdrawn' },
    });
  }

  sendSuccess(res, 200, { application }, 'Application withdrawn successfully');
};
