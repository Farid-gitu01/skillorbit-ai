import mongoose, { type Document, Schema } from 'mongoose';

export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type StepType = 'course' | 'skill' | 'project' | 'reading';

export interface IRoadmapStep {
  order: number;
  title: string;
  description?: string;
  type: StepType;
  resourceId?: mongoose.Types.ObjectId;
  resourceUrl?: string;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface ILearningRoadmap extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  targetRole?: string;
  targetJob?: mongoose.Types.ObjectId;
  steps: IRoadmapStep[];
  currentStep: number;
  progress: number;
  status: RoadmapStatus;
  generatedByAI: boolean;
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
    resourceId: { type: Schema.Types.ObjectId },
    resourceUrl: { type: String, trim: true },
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
    steps: { type: [stepSchema], default: [] },
    currentStep: { type: Number, default: 0, min: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'] as const,
      default: 'active',
    },
    generatedByAI: { type: Boolean, default: true },
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
