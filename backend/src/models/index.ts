/**
 * models/index.ts — Central model barrel
 *
 * Import models from here to avoid scattered relative imports.
 * All 13 Mongoose models are exported along with their TypeScript interfaces.
 *
 * Import order is intentional to prevent circular reference issues:
 * independent models (User, Skill) are listed before dependent ones.
 */

// ── Core identity ────────────────────────────────────────────────────────────
// NOTE: physical file on disk is user.model.ts (lowercase) — use this casing consistently
export { User } from './user.model.js';
export type { IUser, UserRole } from './user.model.js';

export { Profile } from './Profile.model.js';
export type { IProfile, IExperience, IEducation, AvailabilityStatus } from './Profile.model.js';

export { Organization } from './Organization.model.js';
export type { IOrganization, ISocialLinks, OrganizationType, OrganizationSize } from './Organization.model.js';

// ── Skill taxonomy ───────────────────────────────────────────────────────────
export { Skill } from './Skill.model.js';
export type { ISkill } from './Skill.model.js';

export { UserSkill } from './UserSkill.model.js';
export type { IUserSkill, ProficiencyLevel, SkillSource } from './UserSkill.model.js';

export { SkillAssessment } from './SkillAssessment.model.js';
export type { ISkillAssessment, AssessmentStatus, IAssessmentQuestion } from './SkillAssessment.model.js';

// ── Career tools ─────────────────────────────────────────────────────────────
export { Resume } from './Resume.model.js';
export type { IResume, ParseStatus, IParsedData } from './Resume.model.js';

export { LearningRoadmap } from './LearningRoadmap.model.js';
export type { ILearningRoadmap, RoadmapStatus, IRoadmapStep, StepType } from './LearningRoadmap.model.js';

// ── Platform content ─────────────────────────────────────────────────────────
export { Course } from './Course.model.js';
export type { ICourse, CourseLevel, CourseStatus, ISyllabusModule } from './Course.model.js';

export { Job } from './Job.model.js';
export type { IJob, JobLocationType, JobType, ExperienceLevel, JobStatus, ISalary } from './Job.model.js';

export { Application } from './Application.model.js';
export type { IApplication, ApplicationStatus, IAIMatchDetails, IApplicationHistoryItem } from './Application.model.js';

// ── System ────────────────────────────────────────────────────────────────────
export { Notification } from './Notification.model.js';
export type { INotification, NotificationType } from './Notification.model.js';

export { AuditLog } from './AuditLog.model.js';
export type { IAuditLog, ActorRole } from './AuditLog.model.js';
