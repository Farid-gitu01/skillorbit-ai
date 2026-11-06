import mongoose, { type Document, Schema } from 'mongoose';
import type { UserRole } from './user.model.js';

export type ActorRole = UserRole | 'system';

export interface IAuditLog extends Document {
  actor?: mongoose.Types.ObjectId;
  actorRole?: ActorRole;
  action: string;
  resource?: string;
  resourceId?: mongoose.Types.ObjectId;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  createdAt: Date;
}

const ACTOR_ROLES: ActorRole[] = ['seeker', 'employer', 'provider', 'admin', 'system'];

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: ACTOR_ROLES },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    resource: { type: String, trim: true, maxlength: 50 },
    resourceId: { type: Schema.Types.ObjectId },
    // changes contains before/after snapshots — must never include passwords or tokens
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 500 },
    statusCode: { type: Number },
  },
  {
    // Append-only: only createdAt is needed; updatedAt must not exist
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for admin audit queries
auditLogSchema.index({ actor: 1, createdAt: -1 }, { sparse: true });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 }, { sparse: true });
// TTL index: auto-expire records after 2 years (63,072,000 seconds)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
