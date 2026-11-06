# Database Indexes — SkillOrbit AI

> Phase 1.4 · Database Architecture & Schema Design

---

## 1. Overview

Indexes are the primary performance lever in MongoDB. Every index listed here has a specific, documented query pattern it supports. An index that cannot be tied to a real query is not added.

**Naming convention:** Mongoose auto-names compound indexes. Where an explicit name is provided, it follows the pattern `<collection>_<fields>_<type>` (e.g. `applications_seeker_job_unique`).

**General principles applied:**

| Principle | Detail |
|---|---|
| ESR rule | Equality → Sort → Range fields order in compound indexes |
| Sparse indexes | Used on optional fields that are only sometimes present |
| TTL indexes | Used on `notifications.expiresAt` and `auditLogs.createdAt` for auto-expiry |
| Text indexes | One text index per collection (MongoDB limitation) |
| Covered queries | Projection-only queries on indexed fields avoid document fetch |
| Index intersection | MongoDB can combine two single-field indexes; prefer compound for hot paths |
| Write overhead | Each index adds cost to insert/update; only add indexes that service real queries |

---

## 2. Index Definitions by Collection

---

### 2.1 `users`

**Hot query patterns:**
- Login: find by email
- Soft-delete filter: `{ isDeleted: false }`
- Admin user search: search by name or email

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `users_email_unique` | `{ email: 1 }` | Unique | — | Login lookup; prevents duplicate accounts |
| `users_role_isDeleted` | `{ role: 1, isDeleted: 1 }` | Compound | — | Admin: list users by role, exclude deleted |
| `users_createdAt` | `{ createdAt: -1 }` | Single | — | Admin: sort users by newest first |
| `users_text` | `{ name: "text", email: "text" }` | Text | — | Admin: keyword search across users |

**Mongoose schema definition:**
```typescript
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', email: 'text' });
```

---

### 2.2 `profiles`

**Hot query patterns:**
- Load profile for authenticated seeker
- Public profile lookup by user ID

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `profiles_user_unique` | `{ user: 1 }` | Unique | — | One profile per user; fast lookup by userId |
| `profiles_availability` | `{ availability: 1 }` | Single | sparse | Employer: filter seekers by availability |

**Mongoose schema definition:**
```typescript
profileSchema.index({ user: 1 }, { unique: true });
profileSchema.index({ availability: 1 }, { sparse: true });
```

---

### 2.3 `organizations`

**Hot query patterns:**
- Employer loads own organisation
- Admin verifies organisations
- Public browse verified organisations

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `organizations_owner` | `{ owner: 1 }` | Single | — | Load organisation by owner user |
| `organizations_type_isVerified_isDeleted` | `{ type: 1, isVerified: 1, isDeleted: 1 }` | Compound | — | Browse verified employers / providers |
| `organizations_text` | `{ name: "text", description: "text" }` | Text | — | Keyword search for organisations |

**Mongoose schema definition:**
```typescript
organizationSchema.index({ owner: 1 });
organizationSchema.index({ type: 1, isVerified: 1, isDeleted: 1 });
organizationSchema.index({ name: 'text', description: 'text' });
```

---

### 2.4 `resumes`

**Hot query patterns:**
- Load all resumes for a seeker
- Fetch primary resume for application

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `resumes_user_isPrimary` | `{ user: 1, isPrimary: 1 }` | Compound | — | Fetch primary resume for a seeker in one query |
| `resumes_user_parseStatus` | `{ user: 1, parseStatus: 1 }` | Compound | — | Poll pending parse jobs per user |

**Mongoose schema definition:**
```typescript
resumeSchema.index({ user: 1, isPrimary: 1 });
resumeSchema.index({ user: 1, parseStatus: 1 });
```

---

### 2.5 `skills`

**Hot query patterns:**
- Lookup skill by slug (URL routing)
- Browse skills by category
- Autocomplete skill name search

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `skills_slug_unique` | `{ slug: 1 }` | Unique | — | URL-based skill lookup |
| `skills_name_unique` | `{ name: 1 }` | Unique | — | Deduplication; fast exact-match lookup |
| `skills_category_isActive` | `{ category: 1, isActive: 1 }` | Compound | — | Browse skills within a category |
| `skills_text` | `{ name: "text", aliases: "text", category: "text" }` | Text | — | Autocomplete / keyword search |

**Mongoose schema definition:**
```typescript
skillSchema.index({ slug: 1 }, { unique: true });
skillSchema.index({ name: 1 }, { unique: true });
skillSchema.index({ category: 1, isActive: 1 });
skillSchema.index({ name: 'text', aliases: 'text', category: 'text' });
```

---

### 2.6 `userSkills`

**Hot query patterns:**
- Load all skills for a user (profile page)
- Check if a specific skill is already in user's inventory
- Filter users by a specific skill (for AI matching)

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `userSkills_user_skill_unique` | `{ user: 1, skill: 1 }` | Unique Compound | — | One record per user/skill pair; fast existence check |
| `userSkills_user_level` | `{ user: 1, level: 1 }` | Compound | — | Load user's skills filtered by level |
| `userSkills_skill_level` | `{ skill: 1, level: 1 }` | Compound | — | Find users with a specific skill at a given level |

**Mongoose schema definition:**
```typescript
userSkillSchema.index({ user: 1, skill: 1 }, { unique: true });
userSkillSchema.index({ user: 1, level: 1 });
userSkillSchema.index({ skill: 1, level: 1 });
```

---

### 2.7 `skillAssessments`

**Hot query patterns:**
- Load assessment history for a user
- Get latest assessment result for a user+skill pair
- AI: find users who scored high on a specific skill

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `skillAssessments_user_skill_createdAt` | `{ user: 1, skill: 1, createdAt: -1 }` | Compound | — | Latest assessment for a user/skill pair |
| `skillAssessments_skill_score` | `{ skill: 1, score: -1 }` | Compound | — | Leaderboard / AI matching by skill score |
| `skillAssessments_user_status` | `{ user: 1, status: 1 }` | Compound | — | Resume in-progress assessments for a user |

**Mongoose schema definition:**
```typescript
skillAssessmentSchema.index({ user: 1, skill: 1, createdAt: -1 });
skillAssessmentSchema.index({ skill: 1, score: -1 });
skillAssessmentSchema.index({ user: 1, status: 1 });
```

---

### 2.8 `learningRoadmaps`

**Hot query patterns:**
- Load active roadmap for a seeker
- Find roadmaps linked to a specific job

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `learningRoadmaps_user_status` | `{ user: 1, status: 1 }` | Compound | — | Load active roadmap for a user |
| `learningRoadmaps_targetJob` | `{ targetJob: 1 }` | Single | sparse | Find all roadmaps targeting a job |
| `learningRoadmaps_user_createdAt` | `{ user: 1, createdAt: -1 }` | Compound | — | User roadmap history, newest first |

**Mongoose schema definition:**
```typescript
learningRoadmapSchema.index({ user: 1, status: 1 });
learningRoadmapSchema.index({ targetJob: 1 }, { sparse: true });
learningRoadmapSchema.index({ user: 1, createdAt: -1 });
```

---

### 2.9 `courses`

**Hot query patterns:**
- Public browse: published courses, sorted by newest
- Provider: list own courses including drafts
- Keyword search across title, description, tags
- Filter by level or skills

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `courses_provider` | `{ provider: 1 }` | Single | — | Provider's own course list |
| `courses_status_createdAt` | `{ status: 1, createdAt: -1 }` | Compound | — | Public browse: published courses newest first |
| `courses_status_level` | `{ status: 1, level: 1 }` | Compound | — | Filter by level within published courses |
| `courses_skills` | `{ skills: 1 }` | Single | — | Find courses teaching a specific skill |
| `courses_organization` | `{ organization: 1 }` | Single | sparse | All courses under an organisation |
| `courses_text` | `{ title: "text", description: "text", tags: "text" }` | Text | — | Full-text keyword search |

**Mongoose schema definition:**
```typescript
courseSchema.index({ provider: 1 });
courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ status: 1, level: 1 });
courseSchema.index({ skills: 1 });
courseSchema.index({ organization: 1 }, { sparse: true });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
```

---

### 2.10 `jobs`

**Hot query patterns:**
- Public browse: active jobs, sorted by newest
- Employer: own job listings
- Filter by type, locationType, experienceLevel
- Keyword search across title, description
- AI job matching: find jobs by required skills

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `jobs_employer` | `{ employer: 1 }` | Single | — | Employer's own job listings |
| `jobs_status_createdAt` | `{ status: 1, createdAt: -1 }` | Compound | — | Public browse: active jobs newest first |
| `jobs_status_type` | `{ status: 1, type: 1 }` | Compound | — | Filter active jobs by employment type |
| `jobs_status_locationType` | `{ status: 1, locationType: 1 }` | Compound | — | Filter active jobs by work arrangement |
| `jobs_status_experienceLevel` | `{ status: 1, experienceLevel: 1 }` | Compound | — | Filter by experience required |
| `jobs_skills` | `{ skills: 1 }` | Single | — | AI: find jobs requiring a specific skill |
| `jobs_applicationDeadline` | `{ applicationDeadline: 1 }` | Single | sparse | Find/expire jobs past deadline |
| `jobs_organization` | `{ organization: 1 }` | Single | sparse | All jobs under an organisation |
| `jobs_text` | `{ title: "text", description: "text" }` | Text | — | Full-text keyword search |

**Mongoose schema definition:**
```typescript
jobSchema.index({ employer: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ status: 1, type: 1 });
jobSchema.index({ status: 1, locationType: 1 });
jobSchema.index({ status: 1, experienceLevel: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ applicationDeadline: 1 }, { sparse: true });
jobSchema.index({ organization: 1 }, { sparse: true });
jobSchema.index({ title: 'text', description: 'text' });
```

---

### 2.11 `applications`

**Hot query patterns:**
- Seeker: my applications list
- Employer: applicants for a specific job
- Admin: all applications for audit
- Prevent duplicate application

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `applications_seeker_job_unique` | `{ seeker: 1, job: 1 }` | Unique Compound | — | Prevent duplicate applications; fast existence check |
| `applications_seeker_status_createdAt` | `{ seeker: 1, status: 1, createdAt: -1 }` | Compound | — | Seeker: my applications filtered by status |
| `applications_job_status_createdAt` | `{ job: 1, status: 1, createdAt: -1 }` | Compound | — | Employer: applicants for a job filtered by status |
| `applications_job_aiMatchScore` | `{ job: 1, aiMatchScore: -1 }` | Compound | — | Employer: sort applicants by AI match score |

**Mongoose schema definition:**
```typescript
applicationSchema.index({ seeker: 1, job: 1 }, { unique: true });
applicationSchema.index({ seeker: 1, status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, aiMatchScore: -1 });
```

---

### 2.12 `notifications`

**Hot query patterns:**
- User: fetch unread notifications count
- User: load latest notifications (paginated)
- TTL expiry: auto-delete old notifications

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `notifications_recipient_read_createdAt` | `{ recipient: 1, read: 1, createdAt: -1 }` | Compound | — | Fetch unread notifications for a user, newest first |
| `notifications_recipient_createdAt` | `{ recipient: 1, createdAt: -1 }` | Compound | — | Full notification history, paginated |
| `notifications_expiresAt_ttl` | `{ expiresAt: 1 }` | TTL | `expireAfterSeconds: 0`, sparse | Auto-delete expired notifications |

**Mongoose schema definition:**
```typescript
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
```

---

### 2.13 `auditLogs`

**Hot query patterns:**
- Admin: search logs by actor user
- Admin: search logs by action name
- Admin: search logs by resource type and ID
- TTL expiry: auto-delete logs older than retention period

| Index | Fields | Type | Options | Purpose |
|---|---|---|---|---|
| `auditLogs_actor_createdAt` | `{ actor: 1, createdAt: -1 }` | Compound | sparse | Admin: all actions by a specific user |
| `auditLogs_action_createdAt` | `{ action: 1, createdAt: -1 }` | Compound | — | Admin: all occurrences of a specific action |
| `auditLogs_resource_resourceId` | `{ resource: 1, resourceId: 1, createdAt: -1 }` | Compound | sparse | Admin: full history of a specific document |
| `auditLogs_createdAt_ttl` | `{ createdAt: 1 }` | TTL | `expireAfterSeconds: 63072000` (2 years) | Auto-expire old audit records |

**Mongoose schema definition:**
```typescript
auditLogSchema.index({ actor: 1, createdAt: -1 }, { sparse: true });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 }, { sparse: true });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });
```

---

## 3. Complete Index Reference Table

| Collection | Index Fields | Type | Unique | Sparse | TTL |
|---|---|---|---|---|---|
| `users` | `email` | Single | ✅ | — | — |
| `users` | `role, isDeleted` | Compound | — | — | — |
| `users` | `createdAt` | Single | — | — | — |
| `users` | `name(text), email(text)` | Text | — | — | — |
| `profiles` | `user` | Single | ✅ | — | — |
| `profiles` | `availability` | Single | — | ✅ | — |
| `organizations` | `owner` | Single | — | — | — |
| `organizations` | `type, isVerified, isDeleted` | Compound | — | — | — |
| `organizations` | `name(text), description(text)` | Text | — | — | — |
| `resumes` | `user, isPrimary` | Compound | — | — | — |
| `resumes` | `user, parseStatus` | Compound | — | — | — |
| `skills` | `slug` | Single | ✅ | — | — |
| `skills` | `name` | Single | ✅ | — | — |
| `skills` | `category, isActive` | Compound | — | — | — |
| `skills` | `name(text), aliases(text), category(text)` | Text | — | — | — |
| `userSkills` | `user, skill` | Compound | ✅ | — | — |
| `userSkills` | `user, level` | Compound | — | — | — |
| `userSkills` | `skill, level` | Compound | — | — | — |
| `skillAssessments` | `user, skill, createdAt` | Compound | — | — | — |
| `skillAssessments` | `skill, score` | Compound | — | — | — |
| `skillAssessments` | `user, status` | Compound | — | — | — |
| `learningRoadmaps` | `user, status` | Compound | — | — | — |
| `learningRoadmaps` | `targetJob` | Single | — | ✅ | — |
| `learningRoadmaps` | `user, createdAt` | Compound | — | — | — |
| `courses` | `provider` | Single | — | — | — |
| `courses` | `status, createdAt` | Compound | — | — | — |
| `courses` | `status, level` | Compound | — | — | — |
| `courses` | `skills` | Single | — | — | — |
| `courses` | `organization` | Single | — | ✅ | — |
| `courses` | `title(text), description(text), tags(text)` | Text | — | — | — |
| `jobs` | `employer` | Single | — | — | — |
| `jobs` | `status, createdAt` | Compound | — | — | — |
| `jobs` | `status, type` | Compound | — | — | — |
| `jobs` | `status, locationType` | Compound | — | — | — |
| `jobs` | `status, experienceLevel` | Compound | — | — | — |
| `jobs` | `skills` | Single | — | — | — |
| `jobs` | `applicationDeadline` | Single | — | ✅ | — |
| `jobs` | `organization` | Single | — | ✅ | — |
| `jobs` | `title(text), description(text)` | Text | — | — | — |
| `applications` | `seeker, job` | Compound | ✅ | — | — |
| `applications` | `seeker, status, createdAt` | Compound | — | — | — |
| `applications` | `job, status, createdAt` | Compound | — | — | — |
| `applications` | `job, aiMatchScore` | Compound | — | — | — |
| `notifications` | `recipient, read, createdAt` | Compound | — | — | — |
| `notifications` | `recipient, createdAt` | Compound | — | — | — |
| `notifications` | `expiresAt` | Single | — | ✅ | ✅ `expireAfterSeconds: 0` |
| `auditLogs` | `actor, createdAt` | Compound | — | ✅ | — |
| `auditLogs` | `action, createdAt` | Compound | — | — | — |
| `auditLogs` | `resource, resourceId, createdAt` | Compound | — | ✅ | — |
| `auditLogs` | `createdAt` | Single | — | — | ✅ `expireAfterSeconds: 63072000` |

**Total indexes: 49**

---

## 4. Query Optimization Recommendations

### 4.1 Use `.lean()` on read-heavy list endpoints

Mongoose documents carry prototype methods and change tracking. For API responses that only need plain JSON, add `.lean()` to skip Mongoose document instantiation:

```typescript
const jobs = await Job.find({ status: 'active' })
  .select('title location type status createdAt')
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();
```

### 4.2 Project only needed fields

Never return the entire document when only a subset of fields is needed. This reduces network payload and avoids leaking sensitive fields:

```typescript
// Bad — returns all fields including salary.isPublic internals
const job = await Job.findById(id);

// Good — explicit projection
const job = await Job.findById(id)
  .select('title description skills location type salary.min salary.max salary.currency salary.isPublic')
  .lean();
```

### 4.3 Prefer `countDocuments()` over `.length`

```typescript
// Bad — loads all documents to count them
const count = (await Application.find({ job: jobId })).length;

// Good — uses the index without loading documents
const count = await Application.countDocuments({ job: jobId });
```

### 4.4 Paginate all list endpoints

All list endpoints must use `skip()` / `limit()` or cursor-based pagination. Unlimited queries will degrade as data grows:

```typescript
const PAGE_SIZE = 20;
const page = Number(req.query.page) || 1;

const jobs = await Job.find({ status: 'active' })
  .sort({ createdAt: -1 })
  .skip((page - 1) * PAGE_SIZE)
  .limit(PAGE_SIZE)
  .lean();
```

### 4.5 Use `$text` search with a text index

```typescript
// Ensure text index is defined on the model first
const results = await Job.find(
  { $text: { $search: 'react developer remote' } },
  { score: { $meta: 'textScore' } }
)
  .sort({ score: { $meta: 'textScore' } })
  .lean();
```

### 4.6 Aggregation for cross-collection analytics

For dashboard stats (e.g. "applications per job this week"), use the aggregation pipeline instead of multiple round-trips:

```typescript
const stats = await Application.aggregate([
  { $match: { createdAt: { $gte: weekAgo } } },
  { $group: { _id: '$job', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 },
]);
```

### 4.7 Compound index field ordering (ESR rule)

When building a compound index, follow **Equality → Sort → Range**:

```
// Query: { status: 'active', type: 'full-time', createdAt: { $gte: ... } }
// Correct index order: { status: 1, type: 1, createdAt: -1 }
// Not: { createdAt: -1, status: 1, type: 1 }
```

### 4.8 Monitor with `explain()`

During development and before releasing a new query pattern, verify index usage:

```typescript
const explanation = await Job.find({ status: 'active' })
  .sort({ createdAt: -1 })
  .explain('executionStats');
// Check: winningPlan.inputStage.indexName
// Check: totalDocsExamined vs nReturned — should be equal or close
```

---

## 5. TTL Index Summary

| Collection | TTL Field | Expiry | Purpose |
|---|---|---|---|
| `notifications` | `expiresAt` | Document-defined (field value) | Expire time-sensitive notifications |
| `auditLogs` | `createdAt` | 2 years (63,072,000 seconds) | Compliance retention window |

**Note:** MongoDB's TTL worker runs approximately every 60 seconds. Documents are not deleted at the exact expiry moment — plan for up to 60 seconds of delay.

---

## 6. Atlas Search Considerations (Future)

For advanced AI-powered search (semantic job matching, skill similarity), MongoDB Atlas Search can be used in place of `$text`:

| Feature | Atlas Search advantage over `$text` |
|---|---|
| Fuzzy matching | Handles typos (`Reactt` → `React`) |
| Synonyms | Maps `JS` → `JavaScript` via synonym mappings |
| Autocomplete | Dedicated autocomplete edge-ngram analyzer |
| Relevance scoring | BM25 scoring, better than `$meta: textScore` |
| Vector search | `$vectorSearch` for AI embedding-based semantic similarity |

Atlas Search indexes are configured in the Atlas UI / `mongosh`, not via Mongoose schema. They complement (not replace) the standard indexes documented above.
