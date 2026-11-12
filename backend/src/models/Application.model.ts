import mongoose, { type Document, Schema } from 'mongoose';

export type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface IAIMatchDetails {
  matchedSkills?: string[];
  missingSkills?: string[];
  experienceMatch?: boolean;
  summary?: string;
}

export interface IApplicationHistoryItem {
  status: ApplicationStatus;
  changedBy?: mongoose.Types.ObjectId;
  note?: string;
  changedAt: Date;
}

export interface IApplication extends Document {
  seeker: mongoose.Types.ObjectId;
  job: mongoose.Types.ObjectId;
  resume?: mongoose.Types.ObjectId;
  coverLetter?: string;
  status: ApplicationStatus;
  aiMatchScore?: number;
  aiMatchDetails?: IAIMatchDetails;
  employerNote?: string;
  statusHistory: IApplicationHistoryItem[];
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiMatchDetailsSchema = new Schema<IAIMatchDetails>(
  {
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    experienceMatch: { type: Boolean },
    summary: { type: String },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IApplicationHistoryItem>(
  {
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'] as const,
      required: true,
    },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 1000 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    seeker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    resume: { type: Schema.Types.ObjectId, ref: 'Resume' },
    coverLetter: { type: String, maxlength: 5000 },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'] as const,
      default: 'pending',
    },
    aiMatchScore: { type: Number, min: 0, max: 100 },
    aiMatchDetails: { type: aiMatchDetailsSchema },
    employerNote: { type: String, maxlength: 1000 },
    statusHistory: { type: [statusHistorySchema], default: [] },
    withdrawnAt: { type: Date },
  },
  { timestamps: true }
);

// Unique compound: one application per seeker per job
applicationSchema.index({ seeker: 1, job: 1 }, { unique: true });
applicationSchema.index({ seeker: 1, status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, aiMatchScore: -1 });

export const Application = mongoose.model<IApplication>('Application', applicationSchema);
