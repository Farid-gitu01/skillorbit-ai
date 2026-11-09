import mongoose, { type Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'seeker' | 'employer' | 'provider' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ['seeker', 'employer', 'provider', 'admin'] as const,
      default: 'seeker',
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before saving when it has been modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password as string);
};

// Indexes (email unique handled by schema field; additional indexes below)
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
userSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);
