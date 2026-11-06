import mongoose, { type Document, Schema } from 'mongoose';

export type AvailabilityStatus = 'immediate' | '2-weeks' | '1-month' | 'not-looking';

export interface IExperience {
  title: string;
  company: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
}

export interface IEducation {
  institution: string;
  degree?: string;
  field?: string;
  startDate?: Date;
  endDate?: Date;
  grade?: string;
}

export interface IProfile extends Document {
  user: mongoose.Types.ObjectId;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  experience: IExperience[];
  education: IEducation[];
  languages: string[];
  availability?: AvailabilityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const experienceSchema = new Schema<IExperience>(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    description: { type: String },
  },
  { _id: true }
);

const educationSchema = new Schema<IEducation>(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, trim: true },
    field: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    grade: { type: String, trim: true },
  },
  { _id: true }
);

const profileSchema = new Schema<IProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    headline: { type: String, trim: true, maxlength: 200 },
    bio: { type: String, maxlength: 2000 },
    avatarUrl: { type: String, trim: true },
    location: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
    linkedinUrl: { type: String, trim: true },
    githubUrl: { type: String, trim: true },
    portfolioUrl: { type: String, trim: true },
    experience: { type: [experienceSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    languages: { type: [String], default: [] },
    availability: {
      type: String,
      enum: ['immediate', '2-weeks', '1-month', 'not-looking'] as const,
    },
  },
  { timestamps: true }
);

// One profile per user (unique enforced here and in the index)
profileSchema.index({ user: 1 }, { unique: true });
profileSchema.index({ availability: 1 }, { sparse: true });

export const Profile = mongoose.model<IProfile>('Profile', profileSchema);
