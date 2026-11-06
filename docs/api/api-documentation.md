# API Documentation — SkillOrbit AI

> Phase 1.3 · Architecture & Design System Documentation

---

## 1. Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:5000/api` |
| Production | `https://api.skillorbit.ai/api` *(planned)* |

---

## 2. Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

Tokens are issued by `POST /api/auth/login` and `POST /api/auth/register`.  
Default expiry: **7 days** (configurable via `JWT_EXPIRES_IN` env var).

---

## 3. Standard Response Envelope

### Success

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

### Paginated Success

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "pages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Not authorised – invalid token"
}
```

---

## 4. HTTP Status Codes

| Code | Meaning | When used |
|---|---|---|
| `200` | OK | Successful GET, PUT |
| `201` | Created | Successful POST (resource created) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation failure, malformed body |
| `401` | Unauthorised | Missing or invalid JWT |
| `403` | Forbidden | Authenticated but wrong role |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource (e.g. email already registered) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled server exception |

---

## 5. Endpoints

### 5.1 Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | API liveness check |

**Response `200`**
```json
{
  "success": true,
  "message": "SkillOrbit AI API is running!"
}
```

---

### 5.2 Auth

#### POST `/api/auth/register`

Create a new user account.

**Request Body**

```json
{
  "name": "Farid Khan",
  "email": "farid@example.com",
  "password": "secureP@ss1",
  "role": "seeker"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | ✅ | min 2, max 100 |
| `email` | string | ✅ | valid email, unique |
| `password` | string | ✅ | min 8 characters |
| `role` | string | — | `seeker \| employer \| provider` (default: `seeker`) |

> Note: `admin` role cannot be self-assigned; it must be granted by an existing admin.

**Response `201`**
```json
{
  "success": true,
  "token": "<JWT>",
  "data": {
    "_id": "664abc123def",
    "name": "Farid Khan",
    "email": "farid@example.com",
    "role": "seeker",
    "createdAt": "2026-11-05T16:00:00.000Z"
  }
}
```

**Error `409`** — Email already registered
```json
{ "success": false, "message": "Email already in use" }
```

---

#### POST `/api/auth/login`

Authenticate an existing user.

**Request Body**

```json
{
  "email": "farid@example.com",
  "password": "secureP@ss1"
}
```

**Response `200`**
```json
{
  "success": true,
  "token": "<JWT>",
  "data": {
    "_id": "664abc123def",
    "name": "Farid Khan",
    "email": "farid@example.com",
    "role": "seeker"
  }
}
```

**Error `401`** — Invalid credentials
```json
{ "success": false, "message": "Invalid email or password" }
```

---

### 5.3 Users

#### GET `/api/users/me`

Retrieve the profile of the currently authenticated user.

**Headers:** `Authorization: Bearer <JWT>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "_id": "664abc123def",
    "name": "Farid Khan",
    "email": "farid@example.com",
    "role": "seeker",
    "createdAt": "2026-11-05T16:00:00.000Z",
    "updatedAt": "2026-11-05T16:00:00.000Z"
  }
}
```

**Error `401`** — No token / expired token
```json
{ "success": false, "message": "Not authorised – no token" }
```

---

### 5.4 Jobs *(Planned — Phase 2)*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/jobs` | No | — | Browse all active job listings |
| GET | `/api/jobs/:id` | No | — | Get single job detail |
| POST | `/api/jobs` | Yes | `employer` | Create a new job listing |
| PUT | `/api/jobs/:id` | Yes | `employer` | Update own job listing |
| DELETE | `/api/jobs/:id` | Yes | `employer \| admin` | Delete job listing |
| GET | `/api/jobs/:id/applicants` | Yes | `employer` | List applicants for a job |

**Query parameters for `GET /api/jobs`:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Full-text keyword search |
| `skills` | string (comma-separated) | Filter by required skills |
| `location` | string | Filter by location |
| `page` | number | Pagination page (default: 1) |
| `limit` | number | Items per page (default: 20) |

---

### 5.5 Applications *(Planned — Phase 2)*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/applications` | Yes | `seeker` | Submit an application |
| GET | `/api/applications/me` | Yes | `seeker` | Get my applications |
| PUT | `/api/applications/:id/status` | Yes | `employer` | Update application status |

**Application status values:** `pending` · `reviewed` · `accepted` · `rejected`

---

### 5.6 Courses *(Planned — Phase 2)*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/courses` | No | — | Browse all published courses |
| GET | `/api/courses/:id` | No | — | Get course details |
| POST | `/api/courses` | Yes | `provider` | Create a course |
| PUT | `/api/courses/:id` | Yes | `provider` | Update own course |
| DELETE | `/api/courses/:id` | Yes | `provider \| admin` | Delete course |
| POST | `/api/courses/:id/enroll` | Yes | `seeker` | Enroll in a course |
| GET | `/api/courses/:id/learners` | Yes | `provider` | List enrolled learners |

---

### 5.7 AI *(Planned — Phase 3)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/analyze-resume` | Yes | Upload and parse resume, return skill list |
| POST | `/api/ai/skill-gap` | Yes | Compare user skills to job requirements |
| GET | `/api/ai/job-matches` | Yes | Get AI-ranked job recommendations |
| GET | `/api/ai/career-plan` | Yes | Generate personalised career roadmap |

---

### 5.8 Admin *(Planned — Phase 2)*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/admin/users` | Yes | `admin` | List all users (paginated) |
| GET | `/api/admin/users/:id` | Yes | `admin` | Get user detail |
| PUT | `/api/admin/users/:id` | Yes | `admin` | Update user (role change, ban) |
| DELETE | `/api/admin/users/:id` | Yes | `admin` | Delete user account |
| GET | `/api/admin/stats` | Yes | `admin` | Platform usage statistics |

---

## 6. Rate Limiting

Rate limiting is applied via `express-rate-limit` on the auth routes to mitigate brute-force attacks.

| Scope | Window | Max Requests |
|---|---|---|
| `POST /api/auth/*` | 15 minutes | 10 requests |
| All routes | 1 minute | 100 requests |

Exceeded limits return HTTP `429 Too Many Requests`.

---

## 7. Versioning Strategy

The API is currently unversioned (`/api/...`). When breaking changes are introduced, the API will adopt path-based versioning:

```
/api/v1/auth/login
/api/v2/auth/login
```

The current routes are treated as `v1`.
