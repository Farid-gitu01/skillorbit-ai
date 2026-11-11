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

Registration and login set a stateless JWT in the `skillorbit_access` HttpOnly cookie; logout clears it. The JWT is not returned in JSON or stored in browser storage. Generated tokens contain the user ID (`id`) and standard `iat`/`exp` claims only, signed with HS256 using `JWT_SECRET`. `JWT_EXPIRES_IN` defaults to `7d` and is validated at startup; cookie max-age is derived from token expiry. Protected routes parse this cookie, verify the JWT, load the current user, enforce account state, and attach safe identity/role data. Role restrictions use that database-backed role. For cross-origin browser requests, the API allows credentials for explicit trusted origins and Axios sends credentials. See [Authentication Architecture](../architecture/authentication-architecture.md) for details.

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

`message` and `data` are optional for message-only success results. Development-only verification/reset tokens remain nested within `data` and are never returned by production responses.

### Paginated Success

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
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
  "message": "Invalid or expired authentication",
  "code": "INVALID_AUTHENTICATION"
}
```

Validation errors retain the current `errors` array at the top level, alongside `success`, `message`, and `code`; each entry contains `field` and `message`:

```json
{
  "success": false,
  "message": "Login validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "A valid email address is required" }]
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
| `401` | Unauthorised | Missing, invalid, or expired cookie authentication; or ineligible account |
| `403` | Forbidden | Authenticated user lacks the required role |
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
  "data": { "app": "SkillOrbit AI", "status": "ok", "timestamp": "2026-11-10T12:00:00.000Z", "database": "connected" },
  "message": "SkillOrbit AI API is healthy"
}
```

If the database is unavailable, health returns `503` with `{ "success": false, "message": "SkillOrbit AI API is degraded", "code": "SERVICE_UNAVAILABLE" }`.

---

### 5.2 Auth

#### POST `/api/auth/register`

Create a new user account.

**Request Body**

```json
{
  "fullName": "Farid Khan",
  "email": "farid@example.com",
  "password": "secureP@ss1",
  "role": "seeker"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `fullName` | string | ✅ | min 2, max 100; stored in the existing `User.name` field |
| `email` | string | ✅ | valid email, unique |
| `password` | string | ✅ | min 8 characters |
| `role` | string | ✅ | `seeker \| employer \| provider`; public registration rejects `admin` |

Registration creates the account as unverified, stores a hash-only 24-hour verification token, and sends a verification email when SMTP is configured. Login remains allowed for unverified accounts during the MVP. In development without SMTP, the response may contain a verification token for local testing; production responses never contain it. On successful registration, the API also sets the `skillorbit_access` HttpOnly cookie; the JWT is never returned in JSON.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "664abc123def",
      "name": "Farid Khan",
      "email": "farid@example.com",
      "role": "seeker",
      "createdAt": "2026-11-05T16:00:00.000Z",
      "updatedAt": "2026-11-05T16:00:00.000Z"
    }
  },
  "message": "Registration successful"
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
  "data": {
    "user": {
      "_id": "664abc123def",
      "name": "Farid Khan",
      "email": "farid@example.com",
      "role": "seeker"
    }
  },
  "message": "Login successful"
}
```

On success, the server sets the `skillorbit_access` HttpOnly cookie. Its lifetime matches `JWT_EXPIRES_IN`. Login rejects inactive or deleted accounts with the same generic `401` response as invalid credentials. Unverified email does not prevent login during the MVP.

**Error `401`** — Invalid credentials
```json
{ "success": false, "message": "Invalid email or password" }
```

#### POST `/api/auth/forgot-password`

Request JSON: `{ "email": "farid@example.com" }`. Sends a reset link via configured SMTP and returns the same generic response whether or not an eligible account exists:

```json
{
  "success": true,
  "message": "If an account exists, reset instructions can be sent."
}
```

If SMTP is unavailable in development, `data.resetToken` may be included for local testing for every request to avoid account enumeration. Production never returns a reset token. SMTP delivery failures produce a generic response and do not claim delivery succeeded.

#### POST `/api/auth/reset-password`

Request JSON:
```json
{
  "token": "<64-character reset token>",
  "newPassword": "a-new-strong-password"
}
```

The token is single-use and expires after 15 minutes. Success returns `200`; invalid, expired, or reused tokens return the same `400` error. Password reset updates the existing account; it does not revoke already-issued stateless JWTs.

#### POST `/api/auth/verify-email`

Request JSON: `{ "token": "<64-character verification token>" }`. A valid unexpired token is atomically consumed and marks the account email verified. Tokens expire after 24 hours; invalid, expired, and reused tokens return a generic `400` response.

#### POST `/api/auth/resend-verification`

Request JSON: `{ "email": "farid@example.com" }`. Rotates and emails a pending verification token when the account exists and is eligible. The response is generic and does not reveal whether the address is registered or already verified. With no SMTP in development, a development-only token may be included for local testing; no production response contains it.

#### POST `/api/auth/logout`

Clear the authentication cookie. Logout is idempotent and does not revoke a copied stateless JWT.

**Response `200`**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 5.3 Users

#### GET `/api/users/me`

Retrieve the profile of the currently authenticated user.

**Authentication:** Valid `skillorbit_access` cookie. `protect` verifies the JWT, loads the current eligible account, and attaches only safe public identity fields.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "664abc123def",
      "name": "Farid Khan",
      "email": "farid@example.com",
      "role": "seeker",
      "createdAt": "2026-11-05T16:00:00.000Z",
      "updatedAt": "2026-11-05T16:00:00.000Z"
    }
  }
}
```

The response contains only the safe user allowlist (`_id`, `name`, `email`, `role`, `createdAt`, and `updatedAt`); password hashes and internal account/deletion fields are never returned.

**Error `401`** — Missing, invalid, or expired cookie
```json
{ "success": false, "message": "Authentication required" }
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
| General auth endpoints | 15 minutes | 20 requests |
| Password reset and email verification action endpoints | 15 minutes | 5 requests |
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
