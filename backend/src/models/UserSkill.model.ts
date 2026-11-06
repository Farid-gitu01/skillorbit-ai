import mongoose, { type Document, Schema } from 'mongoose';

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type SkillSource = 'manual' | 'resume' | 'assessment' | 'course';

export interface IUserSkill extends Document {
  user: mongoose.Types.ObjectId;
  skill: mongoose.Types.ObjectId;
  level: ProficiencyLevel;
  verifiedLevel?: ProficiencyLevel;
  isVerified: boolean;
  endorsements: number;
  source: SkillSource;
  createdAt: Date;
  updatedAt: Date;
}

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const userSkillSchema = new Schema<IUserSkill>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    level: { type: String, required: true, enum: PROFICIENCY_LEVELS },
    verifiedLevel: { type: String, enum: PROFICIENCY_LEVELS },
    isVerified: { type: Boolean, default: false },
    endorsements: { type: Number, default: 0, min: 0 },
    source: {
      type: String,
      enum: ['manual', 'resume', 'assessment', 'course'] as const,
      default: 'manual',
    },
  },
  { timestamps: true }
);

// Unique compound: one record per user+skill pair
userSkillSchema.index({ user: 1, skill: 1 }, { unique: true });
userSkillSchema.index({ user: 1, level: 1 });
userSkillSchema.index({ skill: 1, level: 1 });

export const UserSkill = mongoose.model<IUserSkill>('UserSkill', userSkillSchema);
