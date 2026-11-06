import mongoose, { type Document, Schema } from 'mongoose';

export type JobLocationType = 'on-site' | 'remote' | 'hybrid';
export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type JobStatus = 'draft' | 'active' | 'closed' | 'expired';

export interface ISalary {
  min?: number;
  max?: number;
  currency?: string;
  isPublic: boolean;
}

export interface IJob extends Document {
  employer: mongoose.Types.ObjectId;
  organization?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  skills: mongoose.Types.ObjectId[];
  location?: string;
  locationType?: JobLocationType;
  type?: JobType;
  salary?: ISalary;
  experienceLevel?: ExperienceLevel;
  applicationDeadline?: Date;
  applicantCount: number;
  status: JobStatus;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const salarySchema = new Schema<ISalary>(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true },
    isPublic: { type: Boolean, default: false },
  },
  { _id: false }
);

const jobSchema = new Schema<IJob>(
  {
    employer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10000 },
    skills: { type: [Schema.Types.ObjectId], ref: 'Skill', default: [] },
    location: { type: String, trim: true, maxlength: 200 },
    locationType: {
      type: String,
      enum: ['on-site', 'remote', 'hybrid'] as const,
    },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'] as const,
    },
    salary: { type: salarySchema },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead', 'executive'] as const,
    },
    applicationDeadline: { type: Date },
    applicantCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'expired'] as const,
      default: 'draft',
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

jobSchema.index({ employer: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ status: 1, type: 1 });
jobSchema.index({ status: 1, locationType: 1 });
jobSchema.index({ status: 1, experienceLevel: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ applicationDeadline: 1 }, { sparse: true });
jobSchema.index({ organization: 1 }, { sparse: true });
jobSchema.index({ title: 'text', description: 'text' });

export const Job = mongoose.model<IJob>('Job', jobSchema);
