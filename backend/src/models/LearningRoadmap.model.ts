import mongoose, { type Document, Schema } from 'mongoose';

export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type StepType = 'course' | 'skill' | 'project' | 'reading';

export interface IRoadmapStep {
  _id?: mongoose.Types.ObjectId;
  order: number;
  title: string;
  description?: string;
  type: StepType;
  skillName?: string;
  estimatedHours?: number;
  topics?: string[];
  projectIdea?: string;
  milestone?: string;
  resourceId?: mongoose.Types.ObjectId;
  resourceUrl?: string;
  resourceSearchQuery?: string;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface ILearningRoadmap extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  targetRole?: string;
  targetJob?: mongoose.Types.ObjectId;
  experienceLevel?: string;
  learningObjectives?: string[];
  missingSkills?: string[];
  estimatedTotalWeeks?: number;
  milestones?: string[];
  steps: IRoadmapStep[];
  currentStep: number;
  progress: number;
  status: RoadmapStatus;
  generatedByAI: boolean;
  lastRegeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stepSchema = new Schema<IRoadmapStep>(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    type: {
      type: String,
      required: true,
      enum: ['course', 'skill', 'project', 'reading'] as const,
    },
    skillName: { type: String, trim: true, maxlength: 100 },
    estimatedHours: { type: Number, min: 1, max: 500 },
    topics: { type: [String], default: [] },
    projectIdea: { type: String, trim: true, maxlength: 500 },
    milestone: { type: String, trim: true, maxlength: 300 },
    resourceId: { type: Schema.Types.ObjectId, ref: 'Course' },
    resourceUrl: { type: String, trim: true },
    resourceSearchQuery: { type: String, trim: true, maxlength: 200 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { _id: true }
);

const learningRoadmapSchema = new Schema<ILearningRoadmap>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    targetRole: { type: String, trim: true, maxlength: 100 },
    targetJob: { type: Schema.Types.ObjectId, ref: 'Job' },
    experienceLevel: { type: String, trim: true, maxlength: 50 },
    learningObjectives: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    estimatedTotalWeeks: { type: Number, min: 1, max: 104 },
    milestones: { type: [String], default: [] },
    steps: { type: [stepSchema], default: [] },
    currentStep: { type: Number, default: 0, min: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'] as const,
      default: 'active',
    },
    generatedByAI: { type: Boolean, default: true },
    lastRegeneratedAt: { type: Date },
  },
  { timestamps: true }
);

learningRoadmapSchema.index({ user: 1, status: 1 });
learningRoadmapSchema.index({ targetJob: 1 }, { sparse: true });
learningRoadmapSchema.index({ user: 1, createdAt: -1 });

export const LearningRoadmap = mongoose.model<ILearningRoadmap>(
  'LearningRoadmap',
  learningRoadmapSchema
);
