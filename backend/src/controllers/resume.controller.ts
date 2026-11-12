import fs from 'node:fs';
import path from 'node:path';
import { type Request, type Response } from 'express';
import { Application } from '../models/Application.model.js';
import { Job } from '../models/Job.model.js';
import { Resume } from '../models/Resume.model.js';
import { sendCreated, sendError, sendSuccess } from '../utils/api-response.util.js';

export const getMyResumes = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const resumes = await Resume.find({ user: userId }).sort({ isPrimary: -1, createdAt: -1 });
  sendSuccess(res, 200, { resumes });
};

export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const file = req.file;
  if (!file) {
    sendError(res, 400, 'Please select a resume file to upload', { code: 'FILE_REQUIRED' });
    return;
  }

  // Check if user has other resumes; if none, make this primary
  const existingCount = await Resume.countDocuments({ user: userId });
  const isPrimary = existingCount === 0 || req.body?.isPrimary === 'true' || req.body?.isPrimary === true;

  if (isPrimary) {
    // Unset primary for previous resumes
    await Resume.updateMany({ user: userId }, { $set: { isPrimary: false } });
  }

  const resume = await Resume.create({
    user: userId,
    fileName: file.originalname,
    fileUrl: file.filename, // Store internal filename
    fileSize: file.size,
    mimeType: file.mimetype,
    isPrimary,
    parseStatus: 'completed',
    parsedData: {
      extractedSkills: [],
      summary: `Uploaded ${file.originalname}`,
    },
    parsedAt: new Date(),
  });

  sendCreated(res, { resume }, 'Resume uploaded successfully');
};

export const downloadResume = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const resume = await Resume.findById(id);
  if (!resume) {
    sendError(res, 404, 'Resume not found', { code: 'RESUME_NOT_FOUND' });
    return;
  }

  // Authorization: owner, admin, or employer with a non-withdrawn application to one of their jobs
  const isOwner = String(resume.user) === String(userId);
  const isAdmin = req.userRole === 'admin';
  let isAuthorizedEmployer = false;

  if (!isOwner && !isAdmin && req.userRole === 'employer' && userId) {
    const employerJobs = await Job.find({ employer: userId, isDeleted: false }).select('_id').lean();
    const employerJobIds = employerJobs.map((j) => j._id);
    if (employerJobIds.length > 0) {
      const authorizedApp = await Application.exists({
        job: { $in: employerJobIds },
        seeker: resume.user,
        status: { $ne: 'withdrawn' },
        $or: [
          { resume: resume._id },
          ...(resume.isPrimary ? [{ resume: { $exists: false } }, { resume: null }] : []),
        ],
      });
      isAuthorizedEmployer = Boolean(authorizedApp);
    }
  }

  if (!isOwner && !isAdmin && !isAuthorizedEmployer) {
    sendError(res, 403, 'Access denied', { code: 'FORBIDDEN' });
    return;
  }

  const filePath = path.resolve(process.cwd(), 'uploads', 'resumes', resume.fileUrl);
  if (!fs.existsSync(filePath)) {
    sendError(res, 404, 'Resume file not found on disk', { code: 'FILE_NOT_FOUND' });
    return;
  }

  res.setHeader('Content-Type', resume.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.fileName)}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};

export const deleteResume = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const resume = await Resume.findOne({ _id: id, user: userId });
  if (!resume) {
    sendError(res, 404, 'Resume not found', { code: 'RESUME_NOT_FOUND' });
    return;
  }

  const filePath = path.resolve(process.cwd(), 'uploads', 'resumes', resume.fileUrl);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore physical delete errors
    }
  }

  await Resume.deleteOne({ _id: id });

  // If deleted resume was primary, assign next available resume as primary
  if (resume.isPrimary) {
    const nextResume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (nextResume) {
      nextResume.isPrimary = true;
      await nextResume.save();
    }
  }

  sendSuccess(res, 200, { deletedId: id }, 'Resume deleted successfully');
};

export const setPrimaryResume = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;

  const resume = await Resume.findOne({ _id: id, user: userId });
  if (!resume) {
    sendError(res, 404, 'Resume not found', { code: 'RESUME_NOT_FOUND' });
    return;
  }

  await Resume.updateMany({ user: userId }, { $set: { isPrimary: false } });
  resume.isPrimary = true;
  await resume.save();

  sendSuccess(res, 200, { resume }, 'Primary resume updated successfully');
};
