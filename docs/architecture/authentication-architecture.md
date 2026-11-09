# Authentication Architecture — SkillOrbit AI

> Phase 1.8.1 · Authentication contract and security decisions  
> **Status:** Registration, login, logout, email verification, password-reset email delivery, cookie-backed authentication, current-user retrieval, and reusable role authorization are implemented. Production deployments must configure SMTP. Frontend verification/reset UI remains outside this phase.

---

## 1. Scope and Existing Foundations

This document records the authentication contract and current implementation for the existing Express, TypeScript, MongoDB/Mongoose, React, and Axios application. Authentication uses the existing `User` model; verification and reset metadata extend that collection without adding models or collections.

The existing `User` model is the sole identity model. It stores `name`, normalized `email`, bcrypt-hashed `password`, `role`, account state, email verification state, and hashes/expirations for one-time verification and reset tokens. Its save hook hashes modified passwords and `matchPassword()` compares a supplied password. Password and token fields are excluded from normal queries. Registration accepts `fullName` at the API boundary and maps it to `User.name`.

The existing JWT configuration is `JWT_SECRET` and `JWT_EXPIRES_IN` (default: `7d`). Startup requires a `JWT_SECRET` of at least 32 non-whitespace characters and validates the expiration setting. Verification emails are sent for new accounts, but `isEmailVerified` does not block MVP login.

---

## 2. Authentication Decisions

- Use a **stateless JWT** as the access credential, delivered only in an HttpOnly cookie. Do not return the token in JSON or expose it to JavaScript.
- Generated JWTs use HS256 and contain the MongoDB user ID in `id`, plus the standard `iat` and `exp` claims. They do not include role, email, password, or other profile data. Verification requires a valid signature, an unexpired `exp`, and a 24-character hexadecimal `id`.
- Use the existing bcrypt implementation in the `User` model; login must explicitly select the password field before calling `matchPassword()`.
- Registration may create only `seeker`, `employer`, or `provider` accounts. The API must reject `admin` self-assignment; admin provisioning remains an authorized administrative operation outside public registration.
- Registration and login issue an access JWT in the HttpOnly cookie after successful authentication; registration does not return the token in JSON.
- Login verifies credentials and current account status before setting the cookie.
- Registration sends an email-verification message. Login remains available to unverified users for MVP compatibility; `isEmailVerified` is informational until a deliberate account-access policy change.
- `protect` authenticates the cookie JWT, loads the current user, validates account state, and establishes the authoritative request identity and role. A role claim in a token, if ever added, must not replace the database role for authorization.
- `restrictTo` enforces allowed roles using that authoritative identity. Resource ownership remains a separate authorization check.
- Logout clears the cookie in the response. There is no token blacklist, refresh token, server-side session, or revocation store. A copied JWT remains usable until expiry unless its account becomes ineligible and the database-backed `protect` check rejects it.
- Password reset uses a separate random, one-use token. Only its SHA-256 hash and expiry are stored on the existing `User` record; the token is not a JWT and does not create a session.

---

## 3. API Contract

All successful and error responses follow the existing `{ success, data?, message? }` envelope. Auth endpoints are under `/api`.

### 3.1 Registration — `POST /api/auth/register`

Request JSON:

| Field | Type | Required | Contract |
|---|---|---:|---|
| `fullName` | string | Yes | 2–100 characters; maps to `User.name`. |
| `email` | string | Yes | Valid email; normalized consistently with the user model. |
| `password` | string | Yes | At least 8 characters; stored only through the existing bcrypt model hook. |
| `role` | string | Yes | `seeker`, `employer`, or `provider`; `admin` is rejected. |

Success: `201 Created`, a safe user projection, and set the access cookie described below. The JWT is never returned in JSON. Verification delivery is attempted. If SMTP is unavailable in development, `data.verificationToken` is provided for local testing only. Duplicate email returns `409 Conflict`. Validation failure returns `400 Bad Request`.

### 3.2 Login — `POST /api/auth/login`

Request JSON: required `email` and `password` strings.

On valid credentials and eligible account, return `200 OK`, set the access cookie described below, and respond with `{ "success": true, "data": { "user": <safe-user> }, "message": "Login successful" }`. Do not include a JWT in the body. Invalid credentials and accounts that are inactive or deleted return a generic `401 Unauthorized` response to avoid disclosing account existence/status. Email verification is not checked for MVP login.

### 3.3 Logout — `POST /api/auth/logout`

Clear the access cookie using the same cookie name, path, and security attributes used when setting it. Return `200 OK` with `{ "success": true, "message": "Logged out successfully" }`. Logout is idempotent and only removes the browser's cookie; it does not revoke a previously copied token.

### 3.4 Current user — `GET /api/users/me`

Requires a valid access cookie. Return `200 OK` with `{ "success": true, "data": { "user": <safe-user> } }`. The safe-user allowlist is `_id`, `name`, `email`, `role`, `createdAt`, and `updatedAt`. Never serialize the whole Mongoose document; exclude `password`, internal account flags, deletion metadata, verification internals, and other non-allowlisted fields.

### 3.5 Authentication and authorization errors

- `401 Unauthorized`: missing, malformed, invalid, or expired cookie JWT; unknown user; inactive or deleted account. Login uses the same generic response for bad credentials and ineligible accounts.
- `403 Forbidden`: authenticated and eligible user does not have a role permitted by the endpoint.
- `400 Bad Request`: invalid request data.
- `409 Conflict`: duplicate registration email.

### 3.6 Email verification — `POST /api/auth/verify-email` and `POST /api/auth/resend-verification`

Registration generates a cryptographically random 32-byte token, stores only its SHA-256 hash and 24-hour expiry on the existing user document, and sends a verification email. The verification API accepts `{ "token": "<64 hex characters>" }`, atomically consumes a matching unexpired token, and sets `isEmailVerified: true`. Invalid, expired, and reused tokens receive the same generic 400 response. Resend accepts `{ "email": "..." }`, rotates the pending token, and always returns a generic response that does not confirm whether the address exists. Both verification endpoints have a dedicated rate limiter. No client-supplied field can set the verification flag.

The email link targets the frontend `/verify-email?token=...` route. The frontend verification UI is outside these phases; it must submit the token to the public API endpoint.

### 3.7 Password reset — `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`

`POST /api/auth/forgot-password` accepts a normalized email. It always returns the same `200` response regardless of whether an eligible account exists. For an active, non-deleted account it stores only the SHA-256 hash of a cryptographically random 32-byte token, with a 15-minute expiry, on the existing `User` document. A dedicated rate limiter applies to both reset endpoints.

The request sends a reset email when SMTP delivery is configured. If no SMTP service exists in development, the generic response may include `data.resetToken` for local testing for matching and non-matching addresses alike. Tokens are never returned in production. SMTP delivery failures do not expose delivery details or claim successful delivery. Production requires complete SMTP configuration at startup.

`POST /api/auth/reset-password` accepts `{ "token": "<64 hex characters>", "newPassword": "..." }`. It hashes the supplied token, atomically matches an unexpired token for an eligible account and unsets the stored hash/expiry before changing the password. Invalid, expired, and reused tokens all return the same `400` response. The new plaintext password is assigned once and saved through the existing bcrypt pre-save hook. Reset tokens and password hashes are never returned or logged. The reset email link targets the frontend `/reset-password?token=...` route; its UI is outside these phases.

Resetting a password does not revoke already-issued stateless access JWTs. They remain valid until expiration unless rejected by a later database-backed account check.

---

## 4. Cookie, CORS, and Browser Requirements

### 4.1 Access cookie

Use the cookie name `skillorbit_access` and these attributes:

| Attribute | Decision |
|---|---|
| `httpOnly` | `true`; browser JavaScript cannot read the token. |
| `secure` | `true` in production (production must use HTTPS); `false` for local HTTP development. |
| `sameSite` | `lax` when frontend and API are same-site, including sibling subdomains such as `skillorbit.ai` and `api.skillorbit.ai`, and localhost on different ports. For genuinely cross-site deployments, use `none` with `secure: true` and implement the CSRF controls described below. |
| `path` | `/`. |
| `maxAge` | Derived from the signed token's `exp` claim; the token itself uses the validated `JWT_EXPIRES_IN` duration. This prevents a second cookie lifetime from drifting from JWT expiry. |

Do not set a broad `Domain` unless deployment requirements explicitly demand shared subdomain scope; a host-only cookie is preferred. Cookie clearing must use the matching name/path and compatible attributes.

### 4.2 CORS and Axios

Cookie authentication requires credentialed cross-origin requests when frontend and backend have different origins (including localhost ports and sibling subdomains): backend CORS must use an explicit allowed origin, never `*`, and set `credentials: true`; the browser Axios client must use `withCredentials: true`. Keep the allowed origins restricted to configured trusted frontend origins. The backend CORS and Axios credential settings are now enabled; bearer-token localStorage handling has been removed. Do not use `localStorage` or `sessionStorage` for authentication credentials.

CORS is not a CSRF defense. The current protected user API has only `GET /users/me`; no general CSRF middleware is installed. Before adding cookie-authenticated state-changing business routes, validate `Origin` against trusted frontend origins or implement an explicit CSRF protection mechanism. `SameSite=Lax` is the MVP default for same-site deployment. Any `SameSite=None` deployment requires HTTPS and explicit CSRF controls.

### 4.3 Cookie parsing

`cookie-parser` is mounted before API routes. Authentication reads the `skillorbit_access` cookie only; Bearer-token fallback is not enabled. Credentialed CORS is restricted to configured frontend origin(s), and the Axios client sends cookies with `withCredentials: true`.

---

## 5. JWT, Identity, and Account-State Rules

- Sign and verify JWTs using the existing `JWT_SECRET` and `JWT_EXPIRES_IN` configuration. There is no runtime fallback. `JWT_EXPIRES_IN` accepts a positive whole-second value (a bare integer means seconds) or an integer duration using `ms`, `s`, `m`, `h`, `d`, `w`, or `y`; sub-second and invalid values fail startup. Both token signing and cookie max-age derive from this same configured lifetime/token expiry.
- Token generation uses HS256 and only the user `id` claim in addition to JWT-standard `iat` and `exp`. Verification restricts the algorithm to HS256 and validates the payload's `id` and `exp`; malformed, tampered, expired, wrong-signature, or invalid-identity tokens are rejected.
- `protect` reads the HttpOnly cookie, verifies it with the existing token utility, then loads the current `User` and enforces active/deleted state. It attaches only safe public identity fields plus the database-backed role; it does not accept a client-supplied role or ID.
- `restrictTo(...roles)` is separate from authentication, supports one or more roles, returns 401 when there is no authenticated identity, and 403 when the database-backed role is not permitted. Resource ownership must be checked separately when resource routes are added.
- Account eligible for login/protected access: `isActive === true`, `isDeleted !== true`, and `deletedAt` is absent/null. Reject if any eligibility condition fails. Missing account records are ineligible.
- `isEmailVerified` is intentionally not an eligibility condition during the MVP.
- A valid identity with a disallowed role receives 403; missing/invalid identity or an ineligible account receives 401.

---

## 6. Roles and Authorization

The complete role set is `seeker`, `employer`, `provider`, and `admin`. Public registration permits only `seeker`, `employer`, and `provider`; admins can only be provisioned through a separately authorized administrative process.

Apply authentication before role checks (`protect`, then `restrictTo(...)`). Expected decisions: authenticated users with an allowed role proceed; authenticated users with another role receive 403; unauthenticated or ineligible users receive 401. Role checks do not prove ownership: endpoints modifying user-owned resources must also compare the resource owner to the authenticated user unless the route's policy explicitly permits an administrator.

---

## 7. Stateless Session Lifecycle and Security Boundaries

1. Successful registration or login creates a signed access JWT with the configured expiration and sets it as `skillorbit_access` with the selected cookie attributes.
2. The browser sends the cookie on eligible API requests; JavaScript cannot access its value.
3. Protected requests verify the token and load current account identity/status from MongoDB.
4. Logout clears the browser cookie. No database write, revocation list, refresh token, or server-side session is created.
5. A copied token can remain valid until its configured expiry while the account remains eligible. Password changes do not immediately invalidate an already-issued stateless token under this design; reducing that window would require an explicit future policy/design change.

Use HTTPS in production, secure cookie flags, restricted credentialed CORS, origin checks for state-changing requests, generic login failures, rate limiting, Zod request validation, password hashing, safe response allowlists, and database-backed account/role checks. Never log passwords, JWTs, cookie headers, or secrets.

---

## 8. Configuration and Dependency Readiness

| Item | Current state | Implementation-phase requirement |
|---|---|---|
| `JWT_SECRET` | Required; startup enforces at least 32 non-whitespace characters. | Continue using it; never expose or hardcode it. |
| `JWT_EXPIRES_IN` | Configurable; defaults to `7d`; validated as a positive whole-second duration. | One parsed seconds value drives signing; cookie max-age is calculated from the signed JWT expiry. |
| `CLIENT_URL` | Single configured frontend origin; local dev also allows localhost:5173. | Ensure each configured trusted origin is explicit and compatible with credentialed CORS. |
| SMTP settings | Nodemailer SMTP service uses `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. | Host, port, user, password, and sender are required in production; development may omit the entire set. |
| `cookie-parser` | Installed and mounted before routes. | Continue using the shared cookie name/options. |
| Password reset | Token hash and expiry are fields on the existing `User` collection. | Reset emails use configured SMTP; local development may return the token only when SMTP is unavailable. |
| Email verification | Hash/expiry fields are on the same `User` collection; token lifetime is 24 hours. | Registration and resend send mail through SMTP; UI route is frontend work outside this phase. |
| Backend tests | Node's built-in `node:test` runner through existing `tsx`; `npm test` targets `backend/test/authentication.test.ts`. | Keep tests using fake SMTP/model persistence unless a separately isolated integration environment is provisioned. |
| Auth rate limit | General auth limit is 20 requests per 15 minutes; reset and verification action endpoints additionally allow 5 requests per 15 minutes and count successful requests. | Keep documentation aligned and retain the dedicated throttles. |

Do not add environment variables for a second token secret or expiry. If deployments later need multiple allowed origins, add and validate an explicit origin configuration as a separate implementation decision rather than using wildcard credentialed CORS.

---

## 9. Authentication Test Coverage and Verification

Backend unit/controller tests use Node's built-in test runner via the existing `tsx` dependency. Run from `backend/` with `npm test`; run `npm run type-check` and `npm run build` for backend checks. Frontend checks are `npm run lint` and `npm run build` from `frontend/`.

The Phase 1.8.8 suite covers registration validation/normalization, duplicate and delivery failures, hash-only verification/reset tokens and expiry/reuse, password hashing, safe response projections, login/account status/cookies, logout scope, cookie JWT verification, DB-backed user status/role behavior, all four roles, 401/403 semantics, SMTP mock transport/errors, environment validation, CORS and browser token-storage configuration. The latest run reported **16 tests passing**.

Tests mock Mongoose persistence and SMTP; they do not connect to MongoDB, run real HTTP requests, or send mail to a live SMTP server. Production readiness still requires real SMTP credentials, frontend verification/reset pages, and deployment-level HTTP/CSRF verification before adding cookie-authenticated mutations.

`npm audit` reported 6 moderate backend advisories and 10 moderate frontend advisories, all in lint/type-lint dependency chains involving `minimatch` and ESLint/TypeScript-ESLint packages. No high or critical findings were reported. No automatic dependency fixes were applied because npm's suggested ESLint/TypeScript-ESLint changes include breaking downgrades; review a targeted compatible dependency update separately.

## 10. Implementation Boundary

Registration, login, logout, email verification, password-reset delivery, cookie-backed authentication, current-user response, and RBAC middleware are implemented. Production must configure SMTP. No refresh-token infrastructure, token blacklist, database session, email verification UI, or password-reset UI is included. Login currently permits unverified accounts; changing that policy requires a deliberate later decision.
