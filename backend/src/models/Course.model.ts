import mongoose, { type Document, Schema } from 'mongoose';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';

export interface ISyllabusModule {
  moduleTitle: string;
  lessons: string[];
  duration?: number;
}

export interface ICourse extends Document {
  provider: mongoose.Types.ObjectId;
  organization?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  skills: mongoose.Types.ObjectId[];
  level?: CourseLevel;
  duration?: number;
  price: number;
  currency: string;
  thumbnailUrl?: string;
  externalUrl?: string;
  syllabus: ISyllabusModule[];
  tags: string[];
  enrollmentCount: number;
  rating?: number;
  ratingCount: number;
  status: CourseStatus;
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

const courseSchema = new Schema<ICourse>(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    skills: { type: [Schema.Types.ObjectId], ref: 'Skill', default: [] },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'] as const,
    },
    duration: { type: Number, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD', trim: true, maxlength: 3 },
    thumbnailUrl: { type: String, trim: true },
    externalUrl: { type: String, trim: true },
    syllabus: { type: [syllabusModuleSchema], default: [] },
    tags: { type: [String], default: [] },
    enrollmentCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'] as const,
      default: 'draft',
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
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Course = mongoose.model<ICourse>('Course', courseSchema);
