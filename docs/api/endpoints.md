# API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

Protected routes use the `skillorbit_access` HttpOnly cookie. The API uses credentialed CORS for explicit configured frontend origins; see the authentication architecture for cookie and role behavior.

---

## Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and set HttpOnly cookie | No |
| POST | `/auth/logout` | Clear authentication cookie | No |
| POST | `/auth/forgot-password` | Request password-reset email | No |
| POST | `/auth/reset-password` | Consume reset token and change password | No |
| POST | `/auth/verify-email` | Verify email with one-time token | No |
| POST | `/auth/resend-verification` | Request another verification email | No |

---

## User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/me` | Get current user profile | Yes |

---

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |

---

> Additional endpoints (jobs, skills, courses, applications) will be documented here as they are implemented.

---

## AI Career Intelligence Module (Seeker — `/api/ai`)

All endpoints under `/api/ai/*` require an authenticated session (`protect`) and the `seeker` role (`restrictTo('seeker')`).

- `GET /api/ai/status` — Returns AI readiness & active provider/model metadata without exposing credentials.
- `POST /api/ai/resume/:resumeId/analyze` — Extracts and analyzes an uploaded PDF/DOCX resume (`{ forceRefresh?: boolean }`). Persists structured analysis and transparent ATS completeness feedback on the resume record.
- `POST /api/ai/skills/extract` — Extracts and normalizes categorized skills from resume/profile data (`{ resumeId?: string, includeProfile?: boolean, forceRefresh?: boolean }`).
- `POST /api/ai/skills/apply` — Applies seeker-selected extracted skills (`{ skills: Array<{ name, category?, level? }> }`) into `Skill`, `UserSkill`, and `Profile.skills` without overwriting existing user skills.
- `POST /api/ai/skill-gap` — Compares seeker skills against a real `jobId` or `targetRole` (`{ jobId?, targetRole?, experienceLevel?, forceRefresh? }`), prioritizing missing skills and matching verified internal courses.
- `GET /api/ai/roadmaps` — Lists persisted seeker learning roadmaps.
- `POST /api/ai/roadmaps/generate` — Generates and persists a personalized learning roadmap (`{ jobId?, targetRole?, experienceLevel?, missingSkills?, weeklyHours? }`).
- `GET /api/ai/roadmaps/:id` — Returns a single seeker-owned learning roadmap.
- `PATCH /api/ai/roadmaps/:id/steps/:stepId` — Toggles step completion (`{ isCompleted: boolean }`) and recalculates roadmap progress/status.
- `POST /api/ai/roadmaps/:id/regenerate` — Safely regenerates roadmap steps while preserving completed progress on matching steps.
- `PATCH /api/ai/roadmaps/:id/status` — Updates roadmap status (`active` | `archived`).
- `DELETE /api/ai/roadmaps/:id` — Deletes a seeker-owned roadmap.
- `POST /api/ai/jobs/:jobId/match` — Computes transparent weighted compatibility score (`0–100`) and optional AI fit explanation for an active job (`{ includeAiExplanation?: boolean }`).
- `GET /api/ai/recommendations/jobs` — Returns deduplicated, filtered, sorted active job recommendations (`?q=&locationType=&type=&experienceLevel=&minScore=&sortBy=&limit=`).
- `GET /api/ai/chat/conversations` — Lists seeker-owned AI career assistant conversations.
- `GET /api/ai/chat/conversations/:id` — Fetches conversation message history.
- `POST /api/ai/chat` — Sends a career question to the AI assistant (`{ message, conversationId?, topic?, includeProfileContext? }`).
- `DELETE /api/ai/chat/conversations/:id` — Deletes a seeker-owned conversation.
