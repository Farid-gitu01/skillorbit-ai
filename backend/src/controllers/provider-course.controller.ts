import { type Request, type Response } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import {
  Course,
  type CourseStatus,
  type ICourse,
} from '../models/Course.model.js';
import { Notification } from '../models/Notification.model.js';
import { Organization } from '../models/Organization.model.js';
import { Skill } from '../models/Skill.model.js';
import { sendCreated, sendError, sendPaginated, sendSuccess } from '../utils/api-response.util.js';
import {
  computeActiveEnrollmentCount,
  escapeRegex,
  recordProviderAudit,
  resolveSkillIds,
} from '../utils/provider.util.js';
import { listOwnedCourseEngagements } from './provider.controller.js';
import type {
  CreateCourseInput,
  EnrollCourseInput,
  UpdateCourseInput,
  UpdateCourseStatusInput,
} from '../validators/provider.validator.js';

async function findOwnedCourseOrFail(
  courseId: string,
  userId: string,
  res: Response
): Promise<ICourse | null> {
  const course = await Course.findOne({ _id: courseId, isDeleted: false });
  if (!course) {
    sendError(res, 404, 'Course offering not found', { code: 'COURSE_NOT_FOUND' });
    return null;
  }
  if (String(course.provider) !== String(userId)) {
    sendError(res, 403, 'Access denied — you do not own this course offering', {
      code: 'FORBIDDEN',
    });
    return null;
  }
  return course;
}

function serializeCourseForResponse<T extends { enrollments?: unknown[] }>(
  course: T,
  options: { viewerUserId?: string; isOwner?: boolean } = {}
): Omit<T, 'enrollments'> & {
  pendingEngagementsCount?: number;
  myEngagement?: {
    _id: string;
    type: string;
    status: string;
    progress: number;
    enrolledAt: Date;
  } | null;
} {
  const entries = Array.isArray(course.enrollments) ? course.enrollments : [];
  const rest = { ...course };
  delete rest.enrollments;

  const extra: {
    pendingEngagementsCount?: number;
    myEngagement?: {
      _id: string;
      type: string;
      status: string;
      progress: number;
      enrolledAt: Date;
    } | null;
  } = {};

  if (options.isOwner) {
    extra.pendingEngagementsCount = entries.filter(
      (entry) => (entry as { status?: string }).status === 'pending'
    ).length;
  } else if (options.viewerUserId) {
    const mine = entries.find(
      (entry) =>
        String((entry as { learner?: unknown }).learner) === String(options.viewerUserId) &&
        (entry as { status?: string }).status !== 'withdrawn'
    ) as
      | {
          _id?: unknown;
          type: string;
          status: string;
          progress?: number;
          enrolledAt: Date;
        }
      | undefined;

    extra.myEngagement = mine
      ? {
          _id: String(mine._id),
          type: mine.type,
          status: mine.status,
          progress: mine.progress ?? 0,
          enrolledAt: mine.enrolledAt,
        }
      : null;
  }

  return {
    ...rest,
    ...extra,
  };
}

export const getPublicCourses = async (req: Request, res: Response): Promise<void> => {
  const {
    q,
    level,
    category,
    deliveryMode,
    skill,
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query as Record<string, unknown>;

  const filter: FilterQuery<ICourse> = {
    status: 'published',
    moderationStatus: { $ne: 'rejected' },
    isDeleted: false,
  };

  if (typeof level === 'string' && level.length > 0) {
    filter.level = level as ICourse['level'];
  }
  if (typeof category === 'string' && category.trim().length > 0) {
    filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
  }
  if (typeof deliveryMode === 'string' && deliveryMode.length > 0) {
    filter.deliveryMode = deliveryMode as ICourse['deliveryMode'];
  }
  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { category: regex }, { tags: regex }];
  }
  if (typeof skill === 'string' && skill.trim().length > 0) {
    const matchingSkills = await Skill.find({
      name: new RegExp(escapeRegex(skill.trim()), 'i'),
      isActive: true,
    })
      .select('_id')
      .lean();
    if (matchingSkills.length === 0) {
      sendPaginated(
        res,
        200,
        { courses: [] },
        { page: 1, limit: Number(limit) || 12, total: 0, pages: 1 }
      );
      return;
    }
    filter.skills = { $in: matchingSkills.map((s) => s._id) };
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'popular') {
    sortOption = { enrollmentCount: -1, createdAt: -1 };
  } else if (sort === 'rating') {
    sortOption = { rating: -1, ratingCount: -1, createdAt: -1 };
  } else if (sort === 'price_asc') {
    sortOption = { price: 1, createdAt: -1 };
  } else if (sort === 'price_desc') {
    sortOption = { price: -1, createdAt: -1 };
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select('-enrollments')
      .populate('organization', 'name logoUrl location industry isVerified')
      .populate('skills', 'name category')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(res, 200, { courses }, { page: pageNum, limit: limitNum, total, pages });
};

export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  const courseId = String(req.params.id);

  const course = await Course.findOne({ _id: courseId, isDeleted: false })
    .populate('organization', 'name logoUrl location industry websiteUrl specialization isVerified')
    .populate('skills', 'name category')
    .populate('provider', 'name')
    .lean();

  if (!course) {
    sendError(res, 404, 'Course offering not found', { code: 'COURSE_NOT_FOUND' });
    return;
  }

  const providerId =
    typeof course.provider === 'object' && course.provider !== null && '_id' in course.provider
      ? String((course.provider as { _id: unknown })._id)
      : String(course.provider);

  const isOwner = Boolean(req.userId && providerId === String(req.userId));
  const isAdmin = req.userRole === 'admin';

  if ((course.status !== 'published' || course.moderationStatus === 'rejected') && !isOwner && !isAdmin) {
    sendError(res, 404, 'Course offering not found', { code: 'COURSE_NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, {
    course: serializeCourseForResponse(course, {
      viewerUserId: req.userId,
      isOwner,
    }),
  });
};

export const getProviderCourses = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const {
    q,
    status = 'all',
    level,
    category,
    sort = 'newest',
    page = 1,
    limit = 10,
  } = req.query as Record<string, unknown>;

  const baseFilter: FilterQuery<ICourse> = {
    provider: new mongoose.Types.ObjectId(userId),
    isDeleted: false,
  };

  const filter: FilterQuery<ICourse> = { ...baseFilter };

  if (typeof status === 'string' && status !== 'all') {
    filter.status = status as CourseStatus;
  }
  if (typeof level === 'string' && level !== 'all' && level.length > 0) {
    filter.level = level as ICourse['level'];
  }
  if (typeof category === 'string' && category.trim().length > 0) {
    filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
  }
  if (typeof q === 'string' && q.trim().length > 0) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { category: regex }, { tags: regex }];
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'enrollments_desc') {
    sortOption = { enrollmentCount: -1, createdAt: -1 };
  } else if (sort === 'price_asc') {
    sortOption = { price: 1, createdAt: -1 };
  } else if (sort === 'price_desc') {
    sortOption = { price: -1, createdAt: -1 };
  }

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [courses, total, statusBuckets] = await Promise.all([
    Course.find(filter)
      .populate('skills', 'name category')
      .populate('organization', 'name logoUrl location')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
    Course.aggregate<{ _id: string; count: number }>([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = {
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };
  for (const bucket of statusBuckets) {
    statusCounts.all += bucket.count;
    if (bucket._id === 'published') statusCounts.published = bucket.count;
    else if (bucket._id === 'draft') statusCounts.draft = bucket.count;
    else if (bucket._id === 'archived') statusCounts.archived = bucket.count;
  }

  const serialized = courses.map((course) =>
    serializeCourseForResponse(course, { isOwner: true })
  );

  const pages = Math.max(Math.ceil(total / limitNum), 1);
  sendPaginated(
    res,
    200,
    { courses: serialized, statusCounts },
    { page: pageNum, limit: limitNum, total, pages }
  );
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const input = req.body as CreateCourseInput;

  const [organization, skillIds] = await Promise.all([
    Organization.findOne({
      owner: userId,
      type: 'training-provider',
      isDeleted: false,
    })
      .select('_id name')
      .lean(),
    resolveSkillIds(input.skills ?? []),
  ]);

  const uniqueTags = Array.from(
    new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
  );

  const course = await Course.create({
    provider: userId,
    organization: organization?._id,
    title: input.title,
    description: input.description,
    category: input.category,
    skills: skillIds,
    level: input.level,
    deliveryMode: input.deliveryMode,
    duration: input.duration,
    price: input.price ?? 0,
    currency: input.currency ?? 'USD',
    certificationOffered: Boolean(input.certificationOffered),
    thumbnailUrl: input.thumbnailUrl,
    externalUrl: input.externalUrl,
    syllabus: input.syllabus ?? [],
    tags: uniqueTags,
    status: input.status ?? 'draft',
  });

  const populatedCourse = await Course.findById(course._id)
    .select('-enrollments')
    .populate('skills', 'name category')
    .populate('organization', 'name logoUrl location')
    .lean();

  await recordProviderAudit({
    actorId: userId,
    action: 'COURSE_CREATED',
    resource: 'Course',
    resourceId: course._id as mongoose.Types.ObjectId,
    changes: { title: course.title, status: course.status },
    statusCode: 201,
  });

  sendCreated(
    res,
    { course: populatedCourse },
    course.status === 'published'
      ? 'Course offering published successfully'
      : 'Course offering saved as draft'
  );
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const course = await findOwnedCourseOrFail(String(req.params.id), userId, res);
  if (!course) return;

  const input = req.body as UpdateCourseInput;

  if (input.title !== undefined) course.title = input.title;
  if (input.description !== undefined) course.description = input.description;
  if (Object.hasOwn(input, 'category')) course.category = input.category;
  if (input.level !== undefined) course.level = input.level;
  if (Object.hasOwn(input, 'deliveryMode')) course.deliveryMode = input.deliveryMode;
  if (Object.hasOwn(input, 'duration')) course.duration = input.duration;
  if (input.price !== undefined) course.price = input.price;
  if (input.currency !== undefined) course.currency = input.currency;
  if (input.certificationOffered !== undefined) {
    course.certificationOffered = input.certificationOffered;
  }
  if (Object.hasOwn(input, 'thumbnailUrl')) course.thumbnailUrl = input.thumbnailUrl;
  if (Object.hasOwn(input, 'externalUrl')) course.externalUrl = input.externalUrl;
  if (input.syllabus !== undefined) course.syllabus = input.syllabus;
  if (input.tags !== undefined) {
    course.tags = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean)));
  }
  if (input.skills !== undefined) {
    course.skills = await resolveSkillIds(input.skills);
  }
  if (input.status !== undefined) {
    course.status = input.status;
  }

  if (!course.organization) {
    const org = await Organization.findOne({
      owner: userId,
      type: 'training-provider',
      isDeleted: false,
    })
      .select('_id')
      .lean();
    if (org) {
      course.organization = org._id as mongoose.Types.ObjectId;
    }
  }

  await course.save();

  const populatedCourse = await Course.findById(course._id)
    .populate('skills', 'name category')
    .populate('organization', 'name logoUrl location')
    .lean();

  await recordProviderAudit({
    actorId: userId,
    action: 'COURSE_UPDATED',
    resource: 'Course',
    resourceId: course._id as mongoose.Types.ObjectId,
    changes: { title: course.title, status: course.status },
    statusCode: 200,
  });

  sendSuccess(
    res,
    200,
    {
      course: populatedCourse
        ? serializeCourseForResponse(populatedCourse, { isOwner: true })
        : null,
    },
    'Course offering updated successfully'
  );
};

export const updateCourseStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const course = await findOwnedCourseOrFail(String(req.params.id), userId, res);
  if (!course) return;

  const { status } = req.body as UpdateCourseStatusInput;
  const previousStatus = course.status;

  course.status = status;
  await course.save();

  await recordProviderAudit({
    actorId: userId,
    action: 'COURSE_STATUS_CHANGED',
    resource: 'Course',
    resourceId: course._id as mongoose.Types.ObjectId,
    changes: { title: course.title, previousStatus, status },
    statusCode: 200,
  });

  const populatedCourse = await Course.findById(course._id)
    .populate('skills', 'name category')
    .populate('organization', 'name logoUrl location')
    .lean();

  const statusMessages: Record<CourseStatus, string> = {
    published: 'Course offering is now published and visible to learners',
    draft: 'Course offering moved back to draft',
    archived: 'Course offering archived successfully',
  };

  sendSuccess(
    res,
    200,
    {
      course: populatedCourse
        ? serializeCourseForResponse(populatedCourse, { isOwner: true })
        : null,
    },
    statusMessages[status]
  );
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const course = await findOwnedCourseOrFail(String(req.params.id), userId, res);
  if (!course) return;

  course.isDeleted = true;
  course.deletedAt = new Date();
  course.status = 'archived';
  await course.save();

  await recordProviderAudit({
    actorId: userId,
    action: 'COURSE_DELETED',
    resource: 'Course',
    resourceId: course._id as mongoose.Types.ObjectId,
    changes: { title: course.title },
    statusCode: 200,
  });

  sendSuccess(res, 200, { deletedId: String(course._id) }, 'Course offering deleted successfully');
};

export const enrollInCourse = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const course = await Course.findOne({
    _id: String(req.params.id),
    isDeleted: false,
    status: 'published',
    moderationStatus: { $ne: 'rejected' },
  });

  if (!course) {
    sendError(res, 404, 'Course offering not found or not published', {
      code: 'COURSE_NOT_FOUND',
    });
    return;
  }

  const { type = 'enrollment', learnerMessage } = req.body as EnrollCourseInput;

  const existingActive = course.enrollments.find(
    (item) =>
      String(item.learner) === String(userId) &&
      item.status !== 'withdrawn' &&
      item.status !== 'declined' &&
      (type === 'enquiry' ? item.type === 'enquiry' && item.status === 'pending' : item.type === 'enrollment')
  );

  if (existingActive) {
    sendError(
      res,
      409,
      type === 'enquiry'
        ? 'You already have an active enquiry pending for this course'
        : 'You are already enrolled in this course',
      { code: 'DUPLICATE_ENGAGEMENT' }
    );
    return;
  }

  const initialStatus = type === 'enquiry' ? 'pending' : 'enrolled';
  const now = new Date();

  course.enrollments.push({
    learner: new mongoose.Types.ObjectId(userId),
    type,
    status: initialStatus,
    progress: 0,
    learnerMessage,
    statusHistory: [
      {
        status: initialStatus,
        changedBy: new mongoose.Types.ObjectId(userId),
        note: learnerMessage,
        changedAt: now,
      },
    ],
    enrolledAt: now,
    updatedAt: now,
  });

  course.enrollmentCount = computeActiveEnrollmentCount(course.enrollments);
  await course.save();

  const savedEntry = course.enrollments[course.enrollments.length - 1];

  try {
    await Notification.create({
      recipient: course.provider,
      type: 'course_enrollment',
      title:
        type === 'enquiry'
          ? `New learner enquiry: ${course.title}`
          : `New course enrollment: ${course.title}`,
      message:
        type === 'enquiry'
          ? `A learner submitted a training enquiry for "${course.title}".`
          : `A learner enrolled in "${course.title}".`,
      link: `/provider/engagements/${savedEntry._id}`,
      metadata: {
        courseId: course._id,
        engagementId: savedEntry._id,
        type,
      },
    });
  } catch {
    // Non-critical notification failure
  }

  sendCreated(
    res,
    {
      engagement: {
        _id: String(savedEntry._id),
        courseId: String(course._id),
        type: savedEntry.type,
        status: savedEntry.status,
        progress: savedEntry.progress,
        enrolledAt: savedEntry.enrolledAt,
      },
    },
    type === 'enquiry' ? 'Course enquiry submitted successfully' : 'Enrolled in course successfully'
  );
};

export const getCourseLearners = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  await listOwnedCourseEngagements({
    userId,
    forcedCourseId: String(req.params.id),
    query: req.query as Record<string, unknown>,
    res,
  });
};
