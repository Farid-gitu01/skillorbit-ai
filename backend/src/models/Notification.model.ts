import mongoose, { type Document, Schema } from 'mongoose';

export type NotificationType =
  | 'application_submitted'
  | 'application_status_changed'
  | 'job_match'
  | 'job_posted'
  | 'course_enrollment'
  | 'course_completed'
  | 'assessment_result'
  | 'roadmap_updated'
  | 'system'
  | 'admin_action';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  'application_submitted',
  'application_status_changed',
  'job_match',
  'job_posted',
  'course_enrollment',
  'course_completed',
  'assessment_result',
  'roadmap_updated',
  'system',
  'admin_action',
];

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, maxlength: 1000 },
    link: { type: String, trim: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    expiresAt: { type: Date },
  },
  {
    // Notifications only have createdAt — no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
// TTL index: MongoDB auto-deletes documents when expiresAt is in the past
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
