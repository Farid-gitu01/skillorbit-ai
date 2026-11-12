import { type Request, type Response } from 'express';
import { type FilterQuery } from 'mongoose';
import { Application } from '../models/Application.model.js';
import { Job, type IJob } from '../models/Job.model.js';
import { Notification } from '../models/Notification.model.js';
import { Profile } from '../models/Profile.model.js';
import { Resume } from '../models/Resume.model.js';
import { User } from '../models/user.model.js';
import { calculateProfileCompletion } from './profile.controller.js';
import { sendError, sendSuccess } from '../utils/api-response.util.js';

export const getSeekerDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  // 1. Fetch User and Profile
  const user = await User.findById(userId).select('name email role createdAt');
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

  // 2. Fetch Resume Count
  const resumeCount = await Resume.countDocuments({ user: userId });
  const hasResume = resumeCount > 0;

  // 3. Profile Completion
  const completion = calculateProfileCompletion(profile, user, hasResume);

  // 4. Application Statistics
  const [
    totalApplications,
    pendingApplications,
    shortlistedApplications,
    acceptedApplications,
    rejectedApplications,
    withdrawnApplications,
  ] = await Promise.all([
    Application.countDocuments({ seeker: userId }),
    Application.countDocuments({ seeker: userId, status: 'pending' }),
    Application.countDocuments({ seeker: userId, status: 'shortlisted' }),
    Application.countDocuments({ seeker: userId, status: 'accepted' }),
    Application.countDocuments({ seeker: userId, status: 'rejected' }),
    Application.countDocuments({ seeker: userId, status: 'withdrawn' }),
  ]);

  // 5. Saved Jobs Count
  const savedJobsCount = profile.savedJobs ? profile.savedJobs.length : 0;

  // 6. Recent Applications (Top 5)
  const recentApplications = await Application.find({ seeker: userId })
    .populate({
      path: 'job',
      select: 'title location locationType type salary status organization',
      populate: { path: 'organization', select: 'name logo' },
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // 7. Recommended Jobs (Top 3)
  const skillsList = profile.skills ?? [];
  const recFilter: FilterQuery<IJob> = {
    status: 'active',
    isDeleted: false,
  };
  if (skillsList.length > 0) {
    const regexList = skillsList.map((s) => new RegExp(s.trim(), 'i'));
    recFilter.$or = [{ title: { $in: regexList } }, { description: { $in: regexList } }];
  }

  let recommendedJobs = await Job.find(recFilter)
    .populate('organization', 'name logo')
    .populate('skills', 'name')
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();

  if (recommendedJobs.length < 3) {
    recommendedJobs = await Job.find({ status: 'active', isDeleted: false })
      .populate('organization', 'name logo')
      .populate('skills', 'name')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
  }

  const savedSet = new Set((profile.savedJobs ?? []).map(String));
  const enhancedRecommended = recommendedJobs.map((j) => ({
    ...j,
    isSaved: savedSet.has(String(j._id)),
  }));

  // 8. Recent Notifications / Activity
  const recentNotifications = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  sendSuccess(res, 200, {
    user,
    profile: {
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      availability: profile.availability,
      skills: profile.skills,
    },
    profileCompletion: {
      percentage: completion.percentage,
      missingFields: completion.missingFields,
    },
    applicationStats: {
      total: totalApplications,
      pending: pendingApplications,
      shortlisted: shortlistedApplications,
      accepted: acceptedApplications,
      rejected: rejectedApplications,
      withdrawn: withdrawnApplications,
    },
    savedJobsCount,
    recentApplications,
    recommendedJobs: enhancedRecommended,
    recentActivity: recentNotifications,
    hasResume,
  });
};
