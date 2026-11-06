import mongoose, { type Document, Schema } from 'mongoose';

export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IParsedData {
  extractedSkills?: string[];
  yearsOfExperience?: number;
  educationLevel?: string;
  summary?: string;
  rawText?: string;
}

export interface IResume extends Document {
  user: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isPrimary: boolean;
  parsedData?: IParsedData;
  parseStatus: ParseStatus;
  parsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parsedDataSchema = new Schema<IParsedData>(
  {
    extractedSkills: { type: [String], default: [] },
    yearsOfExperience: { type: Number, min: 0 },
    educationLevel: { type: String, trim: true },
    summary: { type: String },
    // rawText is intentionally select:false to avoid leaking PII in list queries
    rawText: { type: String, select: false },
  },
  { _id: false }
);

const resumeSchema = new Schema<IResume>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    fileUrl: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
    parsedData: { type: parsedDataSchema },
    parseStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'] as const,
      default: 'pending',
    },
    parsedAt: { type: Date },
  },
  { timestamps: true }
);

resumeSchema.index({ user: 1, isPrimary: 1 });
resumeSchema.index({ user: 1, parseStatus: 1 });

export const Resume = mongoose.model<IResume>('Resume', resumeSchema);
