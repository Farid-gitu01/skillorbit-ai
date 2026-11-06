import mongoose, { type Document, Schema } from 'mongoose';
import type { ProficiencyLevel } from './UserSkill.model.js';

export type AssessmentStatus = 'in-progress' | 'completed' | 'expired';

export interface IAssessmentQuestion {
  questionText: string;
  options: string[];
  selectedAnswer?: string;
  correctAnswer: string;
  isCorrect?: boolean;
}

export interface ISkillAssessment extends Document {
  user: mongoose.Types.ObjectId;
  skill: mongoose.Types.ObjectId;
  score: number;
  level: ProficiencyLevel;
  questions: IAssessmentQuestion[];
  timeTaken?: number;
  status: AssessmentStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const questionSchema = new Schema<IAssessmentQuestion>(
  {
    questionText: { type: String, required: true },
    options: { type: [String], default: [] },
    selectedAnswer: { type: String },
    correctAnswer: { type: String, required: true },
    isCorrect: { type: Boolean },
  },
  { _id: false }
);

const skillAssessmentSchema = new Schema<ISkillAssessment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    level: { type: String, required: true, enum: PROFICIENCY_LEVELS },
    questions: { type: [questionSchema], default: [] },
    timeTaken: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'expired'] as const,
      default: 'completed',
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

skillAssessmentSchema.index({ user: 1, skill: 1, createdAt: -1 });
skillAssessmentSchema.index({ skill: 1, score: -1 });
skillAssessmentSchema.index({ user: 1, status: 1 });

export const SkillAssessment = mongoose.model<ISkillAssessment>(
  'SkillAssessment',
  skillAssessmentSchema
);
