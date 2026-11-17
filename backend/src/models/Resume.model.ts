import mongoose, { type Document, Schema } from 'mongoose';

export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IAtsFeedback {
  estimatedCompletenessScore: number;
  methodology: string;
  formattingFindings: string[];
  keywordObservations: string[];
  recommendations: string[];
}

export interface IResumeAnalysis {
  overview: string;
  professionalSummary: string;
  technicalSkills: string[];
  softSkills: string[];
  toolsAndTechnologies: string[];
  frameworksAndLanguages: string[];
  education: string[];
  workExperience: string[];
  projects: string[];
  certifications: string[];
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  improvementSuggestions: string[];
  atsFeedback: IAtsFeedback;
  analyzedAt: Date;
  provider: string;
  model: string;
  contentHash: string;
}

export interface IParsedData {
  extractedSkills?: string[];
  yearsOfExperience?: number;
  educationLevel?: string;
  summary?: string;
  rawText?: string;
  analysis?: IResumeAnalysis;
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

const atsFeedbackSchema = new Schema<IAtsFeedback>(
  {
    estimatedCompletenessScore: { type: Number, min: 0, max: 100, required: true },
    methodology: { type: String, required: true },
    formattingFindings: { type: [String], default: [] },
    keywordObservations: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
  },
  { _id: false }
);

const resumeAnalysisSchema = new Schema<IResumeAnalysis>(
  {
    overview: { type: String, required: true },
    professionalSummary: { type: String, required: true },
    technicalSkills: { type: [String], default: [] },
    softSkills: { type: [String], default: [] },
    toolsAndTechnologies: { type: [String], default: [] },
    frameworksAndLanguages: { type: [String], default: [] },
    education: { type: [String], default: [] },
    workExperience: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    missingInformation: { type: [String], default: [] },
    improvementSuggestions: { type: [String], default: [] },
    atsFeedback: { type: atsFeedbackSchema, required: true },
    analyzedAt: { type: Date, required: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    contentHash: { type: String, required: true },
  },
  { _id: false }
);

const parsedDataSchema = new Schema<IParsedData>(
  {
    extractedSkills: { type: [String], default: [] },
    yearsOfExperience: { type: Number, min: 0 },
    educationLevel: { type: String, trim: true },
    summary: { type: String },
    // rawText is intentionally select:false to avoid leaking PII in list queries
    rawText: { type: String, select: false },
    analysis: { type: resumeAnalysisSchema },
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
