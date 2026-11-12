import mongoose, { type Document, Schema } from 'mongoose';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseDeliveryMode = 'self-paced' | 'live-cohort' | 'hybrid';
export type CourseModerationStatus = 'approved' | 'flagged' | 'rejected';
export type CourseEngagementType = 'enrollment' | 'enquiry';
export type CourseEngagementStatus =
  | 'pending'
  | 'enrolled'
  | 'active'
  | 'completed'
  | 'declined'
  | 'withdrawn';

export interface ISyllabusModule {
  moduleTitle: string;
  lessons: string[];
  duration?: number;
}

export interface ICourseEngagementHistoryItem {
  status: CourseEngagementStatus;
  changedBy?: mongoose.Types.ObjectId;
  note?: string;
  changedAt: Date;
}

export interface ICourseEnrollment {
  _id?: mongoose.Types.ObjectId;
  learner: mongoose.Types.ObjectId;
  type: CourseEngagementType;
  status: CourseEngagementStatus;
  progress: number;
  learnerMessage?: string;
  providerNote?: string;
  statusHistory: ICourseEngagementHistoryItem[];
  enrolledAt: Date;
  completedAt?: Date;
  updatedAt?: Date;
}

export interface ICourseModerationHistoryItem {
  status: CourseModerationStatus;
  reason?: string;
  changedBy?: mongoose.Types.ObjectId;
  changedAt: Date;
}

export interface ICourse extends Document {
  provider: mongoose.Types.ObjectId;
  organization?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category?: string;
  skills: mongoose.Types.ObjectId[];
  level?: CourseLevel;
  deliveryMode?: CourseDeliveryMode;
  duration?: number;
  price: number;
  currency: string;
  certificationOffered: boolean;
  thumbnailUrl?: string;
  externalUrl?: string;
  syllabus: ISyllabusModule[];
  tags: string[];
  enrollments: ICourseEnrollment[];
  enrollmentCount: number;
  rating?: number;
  ratingCount: number;
  status: CourseStatus;
  moderationStatus?: CourseModerationStatus;
  moderationReason?: string;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  moderationHistory?: ICourseModerationHistoryItem[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const syllabusModuleSchema = new Schema<ISyllabusModule>(
  {
    moduleTitle: { type: String, required: true, trim: true },
    lessons: { type: [String], default: [] },
    duration: { type: Number, min: 0 },
  },
  { _id: false }
);

const engagementHistorySchema = new Schema<ICourseEngagementHistoryItem>(
  {
    status: {
      type: String,
      enum: ['pending', 'enrolled', 'active', 'completed', 'declined', 'withdrawn'] as const,
      required: true,
    },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 1000 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const courseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    learner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['enrollment', 'enquiry'] as const,
      default: 'enrollment',
    },
    status: {
      type: String,
      enum: ['pending', 'enrolled', 'active', 'completed', 'declined', 'withdrawn'] as const,
      default: 'enrolled',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    learnerMessage: { type: String, trim: true, maxlength: 2000 },
    providerNote: { type: String, trim: true, maxlength: 1000 },
    statusHistory: { type: [engagementHistorySchema], default: [] },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const courseSchema = new Schema<ICourse>(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, trim: true, maxlength: 100 },
    skills: { type: [Schema.Types.ObjectId], ref: 'Skill', default: [] },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'] as const,
    },
    deliveryMode: {
      type: String,
      enum: ['self-paced', 'live-cohort', 'hybrid'] as const,
    },
    duration: { type: Number, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD', trim: true, uppercase: true, maxlength: 3 },
    certificationOffered: { type: Boolean, default: false },
    thumbnailUrl: { type: String, trim: true },
    externalUrl: { type: String, trim: true },
    syllabus: { type: [syllabusModuleSchema], default: [] },
    tags: { type: [String], default: [] },
    enrollments: { type: [courseEnrollmentSchema], default: [] },
    enrollmentCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'] as const,
      default: 'draft',
    },
    moderationStatus: {
      type: String,
      enum: ['approved', 'flagged', 'rejected'] as const,
      default: 'approved',
    },
    moderationReason: { type: String, trim: true, maxlength: 1000 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    moderationHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ['approved', 'flagged', 'rejected'] as const,
            required: true,
          },
          reason: { type: String, trim: true, maxlength: 1000 },
          changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

courseSchema.index({ provider: 1 });
courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ status: 1, level: 1 });
courseSchema.index({ skills: 1 });
courseSchema.index({ organization: 1 }, { sparse: true });
courseSchema.index({ 'enrollments._id': 1 }, { sparse: true });
courseSchema.index({ 'enrollments.learner': 1 }, { sparse: true });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Course = mongoose.model<ICourse>('Course', courseSchema);
