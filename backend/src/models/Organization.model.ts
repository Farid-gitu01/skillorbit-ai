import mongoose, { type Document, Schema } from 'mongoose';

export type OrganizationType = 'employer' | 'training-provider';
export type OrganizationSize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';

export interface ISocialLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
}

export interface IOrganization extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  type: OrganizationType;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  industry?: string;
  size?: OrganizationSize;
  founded?: number;
  location?: string;
  socialLinks?: ISocialLinks;
  isVerified: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const socialLinksSchema = new Schema<ISocialLinks>(
  {
    linkedin: { type: String, trim: true },
    twitter: { type: String, trim: true },
    facebook: { type: String, trim: true },
  },
  { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      required: true,
      enum: ['employer', 'training-provider'] as const,
    },
    description: { type: String, maxlength: 3000 },
    logoUrl: { type: String, trim: true },
    websiteUrl: { type: String, trim: true },
    industry: { type: String, trim: true, maxlength: 100 },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+'] as const,
    },
    founded: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear(),
    },
    location: { type: String, trim: true, maxlength: 200 },
    socialLinks: { type: socialLinksSchema },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

organizationSchema.index({ owner: 1 });
organizationSchema.index({ type: 1, isVerified: 1, isDeleted: 1 });
organizationSchema.index({ name: 'text', description: 'text' });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
