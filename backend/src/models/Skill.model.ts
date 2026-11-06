import mongoose, { type Document, Schema } from 'mongoose';

export interface ISkill extends Document {
  name: string;
  slug: string;
  category: string;
  description?: string;
  aliases: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    aliases: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// name and slug uniqueness enforced in schema fields and confirmed by indexes below
skillSchema.index({ slug: 1 }, { unique: true });
skillSchema.index({ name: 1 }, { unique: true });
skillSchema.index({ category: 1, isActive: 1 });
skillSchema.index({ name: 'text', aliases: 'text', category: 'text' });

export const Skill = mongoose.model<ISkill>('Skill', skillSchema);
