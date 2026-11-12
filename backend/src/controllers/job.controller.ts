import { type Request, type Response } from 'express';
import { type FilterQuery } from 'mongoose';
import { Job, type IJob } from '../models/Job.model.js';
import { Profile } from '../models/Profile.model.js';
import { sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    location,
    locationType,
    type,
    experienceLevel,
    page = 1,
    limit = 10,
    sort = 'newest',
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<IJob> = {
    status: 'active',
    moderationStatus: { $ne: 'rejected' },
    isDeleted: false,
  };

  if (q && typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(q.trim(), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { location: regex }];
  }

  if (location && typeof location === 'string') {
    filter.location = new RegExp(location.trim(), 'i');
  }

  if (typeof locationType === 'string' && locationType.length > 0) {
    filter.locationType = locationType as IJob['locationType'];
  }

  if (typeof type === 'string' && type.length > 0) {
    filter.type = type as IJob['type'];
  }

  if (typeof experienceLevel === 'string' && experienceLevel.length > 0) {
    filter.experienceLevel = experienceLevel as IJob['experienceLevel'];
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'deadline') {
    sortOption = { applicationDeadline: 1 };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [total, jobs] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .populate('organization', 'name logo logoUrl website websiteUrl')
      .populate('skills', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  // Check saved status if user is authenticated
  let savedJobIds = new Set<string>();
  if (req.userId) {
    const profile = await Profile.findOne({ user: req.userId }).select('savedJobs').lean();
    if (profile?.savedJobs) {
      savedJobIds = new Set(profile.savedJobs.map(String));
    }
  }

  const enhancedJobs = jobs.map((job) => ({
    ...job,
    isSaved: savedJobIds.has(String(job._id)),
  }));

  const pages = Math.ceil(total / limitNum) || 1;
  sendPaginated(res, 200, { jobs: enhancedJobs }, {
    page: pageNum,
    limit: limitNum,
    total,
    pages,
  });
};

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const job = await Job.findOne({ _id: id, isDeleted: false })
    .populate('organization', 'name logo logoUrl website websiteUrl industry size description location')
    .populate('skills', 'name category')
    .lean();

  if (!job) {
    sendError(res, 404, 'Job not found', { code: 'JOB_NOT_FOUND' });
    return;
  }

  // Prevent exposing unpublished draft or rejected jobs to seekers or other employers
  if (
    (job.status === 'draft' || job.moderationStatus === 'rejected') &&
    String(job.employer) !== String(req.userId) &&
    req.userRole !== 'admin'
  ) {
    sendError(res, 404, 'Job not found', { code: 'JOB_NOT_FOUND' });
    return;
  }

  let isSaved = false;
  if (req.userId) {
    const profile = await Profile.findOne({ user: req.userId }).select('savedJobs').lean();
    if (profile?.savedJobs) {
      isSaved = profile.savedJobs.some((savedId) => String(savedId) === String(job._id));
    }
  }

  sendSuccess(res, 200, { job: { ...job, isSaved } });
};

export const getRecommendedJobs = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  let recommendedSkills: string[] = [];

  if (userId) {
    const profile = await Profile.findOne({ user: userId }).select('skills savedJobs').lean();
    if (profile?.skills) {
      recommendedSkills = profile.skills;
    }
  }

  const query: FilterQuery<IJob> = {
    status: 'active',
    isDeleted: false,
  };

  if (recommendedSkills.length > 0) {
    const regexList = recommendedSkills.map((s) => new RegExp(s.trim(), 'i'));
    query.$or = [
      { title: { $in: regexList } },
      { description: { $in: regexList } },
    ];
  }

  const jobs = await Job.find(query)
    .populate('organization', 'name logo')
    .populate('skills', 'name')
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  // If skill-matched query found few, backfill with newest active jobs
  let finalJobs = jobs;
  if (jobs.length < 3) {
    const fallbackJobs = await Job.find({ status: 'active', isDeleted: false })
      .populate('organization', 'name logo')
      .populate('skills', 'name')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    finalJobs = fallbackJobs;
  }

  let savedJobIds = new Set<string>();
  if (userId) {
    const profile = await Profile.findOne({ user: userId }).select('savedJobs').lean();
    if (profile?.savedJobs) {
      savedJobIds = new Set(profile.savedJobs.map(String));
    }
  }

  const enhancedJobs = finalJobs.map((job) => ({
    ...job,
    isSaved: savedJobIds.has(String(job._id)),
  }));

  sendSuccess(res, 200, { jobs: enhancedJobs });
};

export const saveJob = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const job = await Job.findOne({ _id: id, isDeleted: false });
  if (!job) {
    sendError(res, 404, 'Job not found', { code: 'JOB_NOT_FOUND' });
    return;
  }

  await Profile.findOneAndUpdate(
    { user: userId },
    { $addToSet: { savedJobs: id } },
    { upsert: true }
  );

  sendSuccess(res, 200, { jobId: id, isSaved: true }, 'Job saved successfully');
};

export const unsaveJob = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  await Profile.findOneAndUpdate(
    { user: userId },
    { $pull: { savedJobs: id } }
  );

  sendSuccess(res, 200, { jobId: id, isSaved: false }, 'Job removed from saved jobs');
};

export const getSavedJobs = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const profile = await Profile.findOne({ user: userId }).select('savedJobs');
  if (!profile || !profile.savedJobs?.length) {
    sendSuccess(res, 200, { jobs: [] });
    return;
  }

  const jobs = await Job.find({ _id: { $in: profile.savedJobs }, isDeleted: false })
    .populate('organization', 'name logo location')
    .populate('skills', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const enhancedJobs = jobs.map((job) => ({
    ...job,
    isSaved: true,
  }));

  sendSuccess(res, 200, { jobs: enhancedJobs });
};
