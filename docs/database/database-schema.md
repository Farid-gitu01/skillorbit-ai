# Database Schema — SkillOrbit AI

> Phase 1.4 · Database Architecture & Schema Design  
> Supersedes the Phase 1.3 version of this file.

---

## 1. Overview

| Property | Value |
|---|---|
| **Database** | MongoDB Atlas (cloud-hosted) |
| **ODM** | Mongoose 8 (TypeScript generics) |
| **Connection** | `MONGODB_URI` environment variable |
| **Field naming** | camelCase |
| **Collection naming** | plural lowercase (`users`, `jobs`, …) |
| **Timestamps** | All collections use Mongoose `{ timestamps: true }` — auto-managed `createdAt` / `updatedAt` |
| **Primary key** | `_id` — MongoDB ObjectId (auto-generated) |
| **Soft delete** | `isDeleted: Boolean (default: false)` + `deletedAt: Date` on collections that support it |

---

## 2. Collections

### 2.1 `users`

**Purpose:** Core authentication record for every platform user regardless of role.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `name` | String | ✅ | — | trim, minlength: 2, maxlength: 100 | Full display name |
| `email` | String | ✅ | — | unique, lowercase, valid email format | Account email |
| `password` | String | ✅ | — | minlength: 8, select: false | bcrypt hash (cost 12) |
| `role` | String (enum) | — | `seeker` | `seeker \| employer \| provider \| admin` | Platform role |
| `isActive` | Boolean | — | `true` | — | Account active flag |
| `isEmailVerified` | Boolean | — | `false` | — | Email verification state |
| `lastLoginAt` | Date | — | — | — | Last successful login timestamp |
| `isDeleted` | Boolean | — | `false` | — | Soft-delete flag |
| `deletedAt` | Date | — | — | — | Soft-delete timestamp |
| `createdAt` | Date | auto | — | — | Account creation timestamp |
| `updatedAt` | Date | auto | — | — | Last modification timestamp |

**Pre-save hook:** Hash `password` with bcrypt (cost 12) when field is modified.  
**Instance method:** `matchPassword(plain: string): Promise<boolean>` — bcrypt compare.  
**Sensitive fields:** `password` uses `select: false`; never returned in API responses.

---

### 2.2 `profiles`

**Purpose:** Extended personal / professional profile for job seekers. One profile per seeker user.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `user` | ObjectId | ✅ | — | ref: `users`, unique | Owner (seeker) |
| `headline` | String | — | — | maxlength: 200 | Professional tagline |
| `bio` | String | — | — | maxlength: 2000 | About me |
| `avatarUrl` | String | — | — | valid URL | Profile photo URL |
| `location` | String | — | — | maxlength: 100 | City, Country |
| `phone` | String | — | — | maxlength: 20 | Contact number |
| `linkedinUrl` | String | — | — | valid URL | LinkedIn profile |
| `githubUrl` | String | — | — | valid URL | GitHub profile |
| `portfolioUrl` | String | — | — | valid URL | Portfolio website |
| `experience` | Object[] | — | `[]` | embedded array | Work experience records |
| `education` | Object[] | — | `[]` | embedded array | Education records |
| `languages` | String[] | — | `[]` | — | Spoken languages |
| `availability` | String (enum) | — | — | `immediate \| 2-weeks \| 1-month \| not-looking` | Job availability status |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `experience` item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | String | ✅ | Job title |
| `company` | String | ✅ | Company name |
| `location` | String | — | City / Remote |
| `startDate` | Date | ✅ | Start of employment |
| `endDate` | Date | — | End of employment (null = current) |
| `description` | String | — | Role responsibilities |

**Embedded sub-document — `education` item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `institution` | String | ✅ | School / university name |
| `degree` | String | — | Degree type (BSc, MSc, etc.) |
| `field` | String | — | Field of study |
| `startDate` | Date | — | Start year |
| `endDate` | Date | — | Graduation year |
| `grade` | String | — | Grade / GPA |

---

### 2.3 `organizations`

**Purpose:** Company/organisation profile for employers and training providers.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `owner` | ObjectId | ✅ | — | ref: `users` | Account owner (employer or provider) |
| `name` | String | ✅ | — | trim, maxlength: 200 | Organisation name |
| `type` | String (enum) | ✅ | — | `employer \| training-provider` | Organisation type |
| `description` | String | — | — | maxlength: 3000 | About the organisation |
| `logoUrl` | String | — | — | valid URL | Logo image URL |
| `websiteUrl` | String | — | — | valid URL | Official website |
| `industry` | String | — | — | maxlength: 100 | Industry sector |
| `size` | String (enum) | — | — | `1-10 \| 11-50 \| 51-200 \| 201-500 \| 500+` | Employee count range |
| `founded` | Number | — | — | min: 1800, max: current year | Year founded |
| `location` | String | — | — | maxlength: 200 | HQ location |
| `socialLinks` | Object | — | — | embedded | `{ linkedin, twitter, facebook }` |
| `isVerified` | Boolean | — | `false` | — | Admin-verified flag |
| `isDeleted` | Boolean | — | `false` | — | Soft-delete flag |
| `deletedAt` | Date | — | — | — | Soft-delete timestamp |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

---

### 2.4 `resumes`

**Purpose:** Uploaded resume files and their AI-parsed content for job seekers.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `user` | ObjectId | ✅ | — | ref: `users` | Resume owner (seeker) |
| `fileName` | String | ✅ | — | maxlength: 255 | Original uploaded file name |
| `fileUrl` | String | ✅ | — | valid URL | Storage URL (S3 / GridFS) |
| `fileSize` | Number | ✅ | — | min: 0 | File size in bytes |
| `mimeType` | String | ✅ | — | e.g. `application/pdf` | MIME type |
| `isPrimary` | Boolean | — | `false` | — | Active/primary resume flag |
| `parsedData` | Object | — | — | embedded | AI-extracted structured data |
| `parseStatus` | String (enum) | — | `pending` | `pending \| processing \| completed \| failed` | AI parse status |
| `parsedAt` | Date | — | — | — | Last successful parse timestamp |
| `createdAt` | Date | auto | — | — | Upload timestamp |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `parsedData`:**

| Field | Type | Description |
|---|---|---|
| `extractedSkills` | String[] | Skills identified by AI |
| `yearsOfExperience` | Number | AI-estimated total experience |
| `educationLevel` | String | Highest education level detected |
| `summary` | String | AI-generated professional summary |
| `rawText` | String | Plain text extracted from file |

---

### 2.5 `skills`

**Purpose:** Master catalogue of all recognised skills in the platform (taxonomy).

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `name` | String | ✅ | — | unique, trim, maxlength: 100 | Canonical skill name (e.g. `React`) |
| `slug` | String | ✅ | — | unique, lowercase, URL-safe | URL-friendly identifier |
| `category` | String | ✅ | — | maxlength: 100 | Category (e.g. `Frontend`, `Data Science`) |
| `description` | String | — | — | maxlength: 500 | Short description |
| `aliases` | String[] | — | `[]` | — | Alternative names (e.g. `ReactJS`) |
| `isActive` | Boolean | — | `true` | — | Whether skill is currently in use |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

---

### 2.6 `userSkills`

**Purpose:** Junction collection linking users to skills with proficiency level, endorsements, and verification status.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `user` | ObjectId | ✅ | — | ref: `users` | Skill owner |
| `skill` | ObjectId | ✅ | — | ref: `skills` | Skill reference |
| `level` | String (enum) | ✅ | — | `beginner \| intermediate \| advanced \| expert` | Self-reported proficiency |
| `verifiedLevel` | String (enum) | — | — | same enum as `level` | AI/assessment-verified level |
| `isVerified` | Boolean | — | `false` | — | Whether level has been verified |
| `endorsements` | Number | — | `0` | min: 0 | Peer endorsement count |
| `source` | String (enum) | — | `manual` | `manual \| resume \| assessment \| course` | How the skill was added |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

**Unique constraint:** `{ user, skill }` pair — one record per user per skill.

---

### 2.7 `skillAssessments`

**Purpose:** Records of skill-level assessments taken by users (AI-generated or curated quizzes).

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `user` | ObjectId | ✅ | — | ref: `users` | Assessed user |
| `skill` | ObjectId | ✅ | — | ref: `skills` | Assessed skill |
| `score` | Number | ✅ | — | min: 0, max: 100 | Assessment score (percentage) |
| `level` | String (enum) | ✅ | — | `beginner \| intermediate \| advanced \| expert` | Level awarded by this assessment |
| `questions` | Object[] | — | `[]` | embedded array | Assessment questions and answers |
| `timeTaken` | Number | — | — | min: 0 | Time in seconds |
| `status` | String (enum) | — | `completed` | `in-progress \| completed \| expired` | Assessment state |
| `expiresAt` | Date | — | — | — | When result expires (if applicable) |
| `createdAt` | Date | auto | — | — | Started at |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `questions` item:**

| Field | Type | Description |
|---|---|---|
| `questionText` | String | Question content |
| `options` | String[] | Answer choices |
| `selectedAnswer` | String | User's answer |
| `correctAnswer` | String | Correct answer |
| `isCorrect` | Boolean | Whether user answered correctly |

---

### 2.8 `learningRoadmaps`

**Purpose:** AI-generated personalised learning paths for job seekers based on skill gaps and career goals.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `user` | ObjectId | ✅ | — | ref: `users` | Roadmap owner (seeker) |
| `title` | String | ✅ | — | maxlength: 200 | Roadmap title (e.g. "Become a Full-Stack Engineer") |
| `targetRole` | String | — | — | maxlength: 100 | Target job role |
| `targetJob` | ObjectId | — | — | ref: `jobs` | Specific job this roadmap was generated for |
| `steps` | Object[] | — | `[]` | embedded array | Ordered learning steps |
| `currentStep` | Number | — | `0` | min: 0 | Active step index |
| `progress` | Number | — | `0` | min: 0, max: 100 | Overall completion % |
| `status` | String (enum) | — | `active` | `active \| completed \| archived` | Roadmap state |
| `generatedByAI` | Boolean | — | `true` | — | AI-generated vs manually created |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `steps` item:**

| Field | Type | Description |
|---|---|---|
| `order` | Number | Step sequence number |
| `title` | String | Step title |
| `description` | String | What to learn / do |
| `type` | String (enum) | `course \| skill \| project \| reading` |
| `resourceId` | ObjectId | Ref to `courses` or `skills` (optional) |
| `resourceUrl` | String | External resource URL |
| `isCompleted` | Boolean | Whether user completed this step |
| `completedAt` | Date | Completion timestamp |

---

### 2.9 `courses`

**Purpose:** Training courses published by training providers.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `provider` | ObjectId | ✅ | — | ref: `users` | Publishing provider user |
| `organization` | ObjectId | — | — | ref: `organizations` | Provider's organisation |
| `title` | String | ✅ | — | trim, maxlength: 200 | Course title |
| `description` | String | ✅ | — | maxlength: 5000 | Course overview (Markdown) |
| `skills` | ObjectId[] | — | `[]` | ref: `skills` | Skills taught |
| `level` | String (enum) | — | — | `beginner \| intermediate \| advanced` | Difficulty level |
| `duration` | Number | — | — | min: 0 | Total duration in hours |
| `price` | Number | — | `0` | min: 0 | Price in smallest currency unit |
| `currency` | String | — | `USD` | ISO 4217, maxlength: 3 | Currency code |
| `thumbnailUrl` | String | — | — | valid URL | Cover image URL |
| `externalUrl` | String | — | — | valid URL | External course link |
| `syllabus` | Object[] | — | `[]` | embedded array | Course module breakdown |
| `tags` | String[] | — | `[]` | — | Search tags |
| `enrollmentCount` | Number | — | `0` | min: 0 | Cached enrollment counter |
| `rating` | Number | — | — | min: 0, max: 5 | Average rating (cached) |
| `ratingCount` | Number | — | `0` | min: 0 | Number of ratings |
| `status` | String (enum) | — | `draft` | `draft \| published \| archived` | Visibility state |
| `isDeleted` | Boolean | — | `false` | — | Soft-delete flag |
| `deletedAt` | Date | — | — | — | — |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `syllabus` item:**

| Field | Type | Description |
|---|---|---|
| `moduleTitle` | String | Module name |
| `lessons` | String[] | Lesson titles within module |
| `duration` | Number | Module duration in hours |

---

### 2.10 `jobs`

**Purpose:** Job listings posted by employers.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `employer` | ObjectId | ✅ | — | ref: `users` | Posting employer user |
| `organization` | ObjectId | — | — | ref: `organizations` | Employer's organisation |
| `title` | String | ✅ | — | trim, maxlength: 200 | Job title |
| `description` | String | ✅ | — | maxlength: 10000 | Full job description (Markdown) |
| `skills` | ObjectId[] | — | `[]` | ref: `skills` | Required skills |
| `location` | String | — | — | maxlength: 200 | City / Remote / Hybrid |
| `locationType` | String (enum) | — | — | `on-site \| remote \| hybrid` | Work arrangement |
| `type` | String (enum) | — | — | `full-time \| part-time \| contract \| internship \| freelance` | Employment type |
| `salary` | Object | — | — | embedded | `{ min, max, currency, isPublic }` |
| `experienceLevel` | String (enum) | — | — | `entry \| mid \| senior \| lead \| executive` | Experience required |
| `applicationDeadline` | Date | — | — | — | Last day to apply |
| `applicantCount` | Number | — | `0` | min: 0 | Cached applicant counter |
| `status` | String (enum) | — | `draft` | `draft \| active \| closed \| expired` | Listing state |
| `isDeleted` | Boolean | — | `false` | — | Soft-delete flag |
| `deletedAt` | Date | — | — | — | — |
| `createdAt` | Date | auto | — | — | — |
| `updatedAt` | Date | auto | — | — | — |

**Embedded sub-document — `salary`:**

| Field | Type | Description |
|---|---|---|
| `min` | Number | Minimum salary |
| `max` | Number | Maximum salary |
| `currency` | String | ISO 4217 code |
| `isPublic` | Boolean | Whether salary is shown to applicants |

---

### 2.11 `applications`

**Purpose:** Job applications submitted by seekers to employer job listings.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `seeker` | ObjectId | ✅ | — | ref: `users` | Applicant |
| `job` | ObjectId | ✅ | — | ref: `jobs` | Applied job |
| `resume` | ObjectId | — | — | ref: `resumes` | Resume submitted with application |
| `coverLetter` | String | — | — | maxlength: 5000 | Cover letter text |
| `status` | String (enum) | — | `pending` | `pending \| reviewed \| shortlisted \| accepted \| rejected \| withdrawn` | Application stage |
| `aiMatchScore` | Number | — | — | min: 0, max: 100 | AI-computed match percentage |
| `aiMatchDetails` | Object | — | — | embedded | AI breakdown of match |
| `employerNote` | String | — | — | maxlength: 1000 | Employer's internal note |
| `withdrawnAt` | Date | — | — | — | Withdrawal timestamp |
| `createdAt` | Date | auto | — | — | Submission timestamp |
| `updatedAt` | Date | auto | — | — | — |

**Unique constraint:** `{ seeker, job }` — one application per seeker per job.

**Embedded sub-document — `aiMatchDetails`:**

| Field | Type | Description |
|---|---|---|
| `matchedSkills` | String[] | Skills matching the job requirements |
| `missingSkills` | String[] | Required skills the seeker lacks |
| `experienceMatch` | Boolean | Experience level fits the job |
| `summary` | String | AI narrative summary of the match |

---

### 2.12 `notifications`

**Purpose:** In-platform notifications delivered to users across all roles.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `recipient` | ObjectId | ✅ | — | ref: `users` | Target user |
| `type` | String (enum) | ✅ | — | see enum below | Notification category |
| `title` | String | ✅ | — | maxlength: 200 | Short notification heading |
| `message` | String | — | — | maxlength: 1000 | Notification body |
| `link` | String | — | — | in-app path | Deep link for navigation |
| `read` | Boolean | — | `false` | — | Read/unread state |
| `readAt` | Date | — | — | — | When notification was read |
| `metadata` | Object | — | — | embedded | Extra context (IDs, role-specific data) |
| `expiresAt` | Date | — | — | — | Auto-expire timestamp (TTL) |
| `createdAt` | Date | auto | — | — | — |

**`type` enum values:**

| Value | Trigger |
|---|---|
| `application_submitted` | Seeker submits application |
| `application_status_changed` | Employer updates application status |
| `job_match` | AI finds new matching jobs for seeker |
| `job_posted` | New job posted matching seeker's profile |
| `course_enrollment` | Seeker enrolls in a course |
| `course_completed` | Seeker completes a course |
| `assessment_result` | Skill assessment completed |
| `roadmap_updated` | AI updates learning roadmap |
| `system` | Platform announcements |
| `admin_action` | Admin action on user's account |

---

### 2.13 `auditLogs`

**Purpose:** Immutable record of all significant platform actions for security, compliance, and debugging.

| Field | Type | Required | Default | Validation / Constraints | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | auto | — | — | Primary key |
| `actor` | ObjectId | — | — | ref: `users` | User who performed the action (null = system) |
| `actorRole` | String (enum) | — | — | `seeker \| employer \| provider \| admin \| system` | Role at time of action |
| `action` | String | ✅ | — | maxlength: 100 | Action name (e.g. `user.login`, `job.create`) |
| `resource` | String | — | — | maxlength: 50 | Affected resource type (`user`, `job`, `application`, …) |
| `resourceId` | ObjectId | — | — | — | ID of the affected resource |
| `changes` | Object | — | — | embedded | Before/after snapshot for update actions |
| `ipAddress` | String | — | — | valid IP | Client IP address |
| `userAgent` | String | — | — | maxlength: 500 | Client user-agent string |
| `statusCode` | Number | — | — | — | HTTP response status code |
| `createdAt` | Date | auto | — | — | Action timestamp |

**Note:** `auditLogs` is **append-only**. Records must never be updated or deleted.  
A MongoDB TTL index can expire logs older than the retention period (e.g. 2 years).

---

## 3. Data Conventions

| Convention | Rule |
|---|---|
| Timestamps | All collections use Mongoose `{ timestamps: true }` for `createdAt` / `updatedAt` |
| Soft delete | `isDeleted: Boolean (default: false)` + `deletedAt: Date` on `users`, `organizations`, `jobs`, `courses` |
| Password field | `select: false` — never returned in API responses |
| ObjectId refs | Cross-collection references always use `ObjectId` with `ref:` declared |
| Populate policy | Populate only when necessary; prefer lean queries + projection for list endpoints |
| Enums | Defined as both Mongoose enum constraint and TypeScript union type in `types/` |
| Currency | Stored as smallest unit integer OR as Number with explicit `currency` field |
| Audit trail | Destructive or role-changing actions must write an `auditLogs` record |
| AI fields | AI-generated content fields are suffixed with a status field (e.g. `parseStatus`, `generatedByAI`) |
| Text content | Long text fields (descriptions, cover letters) allow Markdown |
