import { type Request, type Response } from 'express';
import { Application } from '../models/Application.model.js';
import { Job } from '../models/Job.model.js';
import { Profile } from '../models/Profile.model.js';
import { Resume } from '../models/Resume.model.js';
import { User } from '../models/user.model.js';
import { sendError, sendSuccess } from '../utils/api-response.util.js';

export interface ProfileCompletionResult {
  percentage: number;
  missingFields: string[];
}

export function calculateProfileCompletion(
  profile: {
    headline?: string;
    bio?: string;
    location?: string;
    experience?: unknown[];
    education?: unknown[];
    skills?: string[];
  } | null,
  user: { name?: string; email?: string } | null,
  hasResume: boolean
): ProfileCompletionResult {
  let score = 0;
  const missingFields: string[] = [];

  // Personal Info (15%)
  if (user?.name && user?.email) {
    score += 15;
  } else {
    missingFields.push('Personal Details');
  }

  // Headline (15%)
  if (profile?.headline && profile.headline.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Professional Headline');
  }

  // Bio (10%)
  if (profile?.bio && profile.bio.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Professional Bio');
  }

  // Location (10%)
  if (profile?.location && profile.location.trim().length > 0) {
    score += 10;
  } else {
    missingFields.push('Location');
  }

  // Experience (15%)
  if (Array.isArray(profile?.experience) && profile.experience.length > 0) {
    score += 15;
  } else {
    missingFields.push('Work Experience');
  }

  // Education (15%)
  if (Array.isArray(profile?.education) && profile.education.length > 0) {
    score += 15;
  } else {
    missingFields.push('Education');
  }

  // Skills (10%)
  if (Array.isArray(profile?.skills) && profile.skills.length > 0) {
    score += 10;
  } else {
    missingFields.push('Key Skills');
  }

  // Resume (10%)
  if (hasResume) {
    score += 10;
  } else {
    missingFields.push('Resume Upload');
  }

  return { percentage: Math.min(score, 100), missingFields };
}

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  let profile = await Profile.findOne({ user: userId });
  if (!profile) {
    profile = await Profile.create({
      user: userId,
      experience: [],
      education: [],
      skills: [],
      languages: [],
      savedJobs: [],
    });
  }

  const user = await User.findById(userId).select('name email role');
  const resumeCount = await Resume.countDocuments({ user: userId });
  const completion = calculateProfileCompletion(profile, user, resumeCount > 0);

  sendSuccess(res, 200, {
    profile: {
      ...profile.toObject(),
      user,
      completionPercentage: completion.percentage,
      missingFields: completion.missingFields,
    },
  });
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const allowedUpdates = [
    'headline',
    'bio',
    'avatarUrl',
    'location',
    'phone',
    'linkedinUrl',
    'githubUrl',
    'portfolioUrl',
    'skills',
    'languages',
    'availability',
    'experience',
    'education',
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedUpdates) {
    if (field in req.body) {
      updateData[field] = req.body[field];
    }
  }

  const profile = await Profile.findOneAndUpdate(
    { user: userId },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true }
  );

  const user = await User.findById(userId).select('name email role');
  const resumeCount = await Resume.countDocuments({ user: userId });
  const completion = calculateProfileCompletion(profile, user, resumeCount > 0);

  sendSuccess(res, 200, {
    profile: {
      ...profile.toObject(),
      user,
      completionPercentage: completion.percentage,
      missingFields: completion.missingFields,
    },
  }, 'Profile updated successfully');
};

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const isOwner = String(id) === String(userId);
  const isAdmin = req.userRole === 'admin';
  let hasEmployerRelationship = false;

  if (!isOwner && !isAdmin && req.userRole === 'employer' && userId) {
    const employerJobs = await Job.find({ employer: userId, isDeleted: false }).select('_id').lean();
    const employerJobIds = employerJobs.map((j) => j._id);
    if (employerJobIds.length > 0) {
      const appExists = await Application.exists({
        job: { $in: employerJobIds },
        seeker: id,
        status: { $ne: 'withdrawn' },
      });
      hasEmployerRelationship = Boolean(appExists);
    }
  }

  const canViewContactInfo = isOwner || isAdmin || hasEmployerRelationship;

  const profile = await Profile.findOne({ user: id })
    .select(canViewContactInfo ? '-savedJobs' : '-savedJobs -phone')
    .populate('user', canViewContactInfo ? 'name email role' : 'name role')
    .lean();

  if (!profile) {
    sendError(res, 404, 'Profile not found', { code: 'PROFILE_NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, { profile });
};
