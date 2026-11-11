# API Security & Rate Limiting — SkillOrbit AI

> Phase 1.9.5 · Comprehensive API hardening, rate limiting, and request protection

This document specifies the security architecture, configuration standards, attack mitigation strategies, and verification procedures implemented across the SkillOrbit AI backend.

---

## 1. Security Architecture Overview

The backend security model follows a **defense-in-depth** strategy operating across multiple network and application layers:

```
[ Incoming Client Request ]
           │
           ▼
[ 1. Express Disables 'x-powered-by' ]
           │
           ▼
[ 2. HTTP Method Filter (Method Whitelist / 405 Method Not Allowed) ]
           │
           ▼
[ 3. Helmet HTTP Security Headers (HSTS, CSP, CORP, Sniff Protection) ]
           │
           ▼
[ 4. Strict CORS Policy (Explicit Origins, Credentials, Preflight Caching) ]
           │
           ▼
[ 5. Body Parsers with 10KB Payload Limit & Cookie Parser ]
           │
           ▼
[ 6. NoSQL / MongoDB Operator Injection Sanitization ($ and . stripping) ]
           │
           ▼
[ 7. CSRF Defense (Origin / Referer / Sec-Fetch-Site Validation) ]
           │
           ▼
[ 8. Global API Rate Limiter (100 req / 15 min window) ]
           │
           ▼
[ 9. Central /api Router ]
           ├── /health (Unrestricted)
           └── /auth (Tiered Route Limiters: Auth, Login, Register, Reset, Verify)
                    │
                    ▼
[ 10. Route Authentication Guard (HttpOnly Cookie JWT Verification) ]
                    │
                    ▼
[ 11. Role-Based Access Control (RBAC: seeker, employer, mentor, admin) ]
                    │
                    ▼
[ 12. Centralized Error Normalizer & Safe Standard Envelope ]
```

---

## 2. HTTP Security Headers (Helmet)

Helmet is configured at the root Express application (`backend/src/app.ts`) to inject industry-standard protective headers on every response:

- **Disable Fingerprinting:** `app.disable('x-powered-by')` removes the default Express signature before any headers are generated.
- **Content Security Policy (CSP):** Because the backend is an API service (not serving HTML), `default-src: ["'none'"]` and `frame-ancestors: ["'none'"]` are enforced to prevent injection and embedding in iframes.
- **Cross-Origin Resource Policy (CORP):** Set to `'cross-origin'` to permit legitimate authenticated single-page applications (SPAs) to consume API resources.
- **HTTP Strict Transport Security (HSTS):** Enforced with a 1-year max age (`31,536,000` seconds), `includeSubDomains: true`, and `preload: true` to prevent downgrade attacks.
- **MIME Sniffing Prevention:** `X-Content-Type-Options: nosniff` prevents browsers from interpreting responses as unintended MIME types.
- **Clickjacking Defense:** `X-Frame-Options: DENY` ensures the API cannot be rendered in any frame or iframe.

---

## 3. CORS Policy (Cross-Origin Resource Sharing)

Cross-Origin Resource Sharing is strictly controlled using dynamic origin validation (`backend/src/middlewares/security.middleware.ts`):

- **Explicit Origin Whitelisting:**
  - Production: Only the explicitly configured `CLIENT_URL` environment variable is accepted.
  - Development / Test: `CLIENT_URL`, `http://localhost:5173`, and `http://127.0.0.1:5173` are permitted.
  - Wildcards (`*`) are **strictly prohibited** in conjunction with credentials.
- **Credentials Support:** `credentials: true` is configured to allow browsers to exchange secure HttpOnly cookies across origins.
- **Allowed HTTP Methods:** `GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD`.
- **Allowed Headers:** `Content-Type, Authorization, Accept, X-Requested-With`.
- **Exposed Headers:** `RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Set-Cookie`.
- **Preflight Cache:** `maxAge: 86400` (24 hours) reduces repetitive preflight `OPTIONS` network overhead.

---

## 4. Rate-Limiting Strategy & Tiered Limits

Rate limiting is implemented using `express-rate-limit` wrapped in a centralized factory function (`backend/src/middlewares/rate-limit.middleware.ts`). All rate limiters conform to the IETF `RateLimit-*` draft header standard (`standardHeaders: true`, `legacyHeaders: false`) and emit standard error responses.

| Limiter | Scope | Window | Max Requests | Response Code | Purpose |
|---|---|---:|---:|---|---|
| `globalLimiter` | All `/api/*` routes | 15 minutes | 100 | `RATE_LIMITED` | Baseline DDoS and scraping defense |
| `authLimiter` | Entire `/api/auth/*` tree | 15 minutes | 20 | `AUTH_RATE_LIMITED` | Prevents credential scanning across auth endpoints |
| `loginLimiter` | `POST /api/auth/login` | 15 minutes | 5 | `LOGIN_RATE_LIMITED` | Brute-force and password guessing protection |
| `registerLimiter` | `POST /api/auth/register` | 15 minutes | 5 | `REGISTER_RATE_LIMITED` | Automated account creation and spam mitigation |
| `passwordResetLimiter` | `POST /api/auth/forgot-password` | 60 minutes | 3 | `PASSWORD_RESET_RATE_LIMITED` | Email flooding and enumeration prevention |
| `emailVerificationLimiter` | `POST /api/auth/resend-verification` | 60 minutes | 3 | `VERIFICATION_RATE_LIMITED` | Verification email harassment protection |

When an endpoint exceeds its threshold, the client receives HTTP 429:
```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMITED"
}
```

---

## 5. Authentication & Cookie Security

Authentication relies exclusively on secure, server-managed JWTs delivered via cookies (`backend/src/utils/auth-cookie.util.ts`):

- **Cookie Flags:**
  - `httpOnly: true`: Completely inaccessible to client-side JavaScript (`document.cookie`), preventing theft via Cross-Site Scripting (XSS).
  - `sameSite: 'lax'`: Mitigates cross-site request forgery while allowing top-level navigation.
  - `secure: IS_PRODUCTION`: Transmitted exclusively over HTTPS in production environments.
  - `path: '/'`: Scoped strictly to the API root.
  - `maxAge`: Synchronized with `JWT_EXPIRES_IN_SECONDS` (derived from validated `JWT_EXPIRES_IN`).
- **Logout Invalidation:** `logout` clears the authentication cookie with identical `path`, `sameSite`, and `httpOnly` attributes to ensure complete removal from the browser jar.
- **Account Enumeration Defense:**
  - Login failure emits generic message `"Invalid email or password"` for missing accounts, wrong passwords, unverified accounts, or deactivated users alike.
  - Password reset requests emit generic success `"If an account exists with that email, a password reset link has been sent."` regardless of whether the email is registered.
  - Token verification and resend endpoints return identical generic responses.
- **Storage Rule:** JWT tokens are **never** stored in client `localStorage` or `sessionStorage`.

---

## 6. CSRF Defense Strategy

SkillOrbit AI implements a multi-layer defense against Cross-Site Request Forgery:

1. **SameSite Lax Cookies:** First-line defense preventing cookies from being attached to cross-origin subresource requests (e.g., `<img>`, `<iframe>`, fetch).
2. **Origin & Sec-Fetch-Site Validation (`backend/src/middlewares/security.middleware.ts`):**
   - Applied globally to all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - If the modern `Sec-Fetch-Site` header is present and equals `'cross-site'`, the request is immediately rejected with HTTP 403 `CSRF_INVALID_ORIGIN`.
   - If `Origin` or `Referer` headers are present, they are validated against the trusted origin whitelist (`getAllowedOrigins()`). Cross-origin mutating requests from untrusted origins are rejected with HTTP 403 `CSRF_INVALID_ORIGIN`.
   - Direct API clients, CLI tools, automated curl scripts, and backend-to-backend calls without `Origin`/`Referer` are safely permitted while browser-initiated CSRF attacks are blocked.

---

## 7. Request Security & Input Sanitization

- **HTTP Method Whitelist (`methodFilter`):** Permitted verbs are strictly limited to `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`. Dangerous or unexpected verbs (`TRACE`, `CONNECT`, `TRACK`, `PURGE`) receive immediate HTTP 405 `Method Not Allowed` with an `Allow` header.
- **Payload Size Limits:** `express.json({ limit: '10kb' })` and `express.urlencoded({ limit: '10kb' })` protect against buffer exhaustion and large payload denial-of-service attacks.
- **Parser Error Normalization:** Oversized payloads trigger HTTP 413 `PAYLOAD_TOO_LARGE`. Malformed JSON bodies trigger HTTP 400 `MALFORMED_REQUEST`.
- **NoSQL / MongoDB Operator Injection Sanitization (`sanitizeMongo`):** Recursively inspects `req.body`, `req.query`, and `req.params`. Any key starting with `$` (MongoDB query operators like `$gt`, `$ne`, `$where`) or containing a `.` (dot notation path manipulation) is stripped prior to reaching route handlers or queries.
- **Error Obfuscation:** The centralized error middleware suppresses internal error messages and stack traces in production, returning safe generic error structures.

---

## 8. Environment Variable Requirements & Secret Management

Security-critical values are enforced at application boot by `backend/src/config/env.ts`:

- `JWT_SECRET`: Must be a cryptographically strong string of **at least 32 characters**. Application startup crashes immediately if this condition is not met.
- `MONGODB_URI`: Validated connection string required at boot.
- `CLIENT_URL`: Trusted frontend URL required for strict CORS origin resolution.
- `NODE_ENV`: Must be explicitly set to `'development'`, `'test'`, or `'production'`.

**Strict Secret Isolation:**
- No credentials, tokens, or private keys are hardcoded in the codebase.
- `.env`, `.env.local`, and credential files are strictly excluded from Git tracking via `.gitignore`.
- Raw secret strings are never logged to console, files, or API responses.

---

## 9. Security Testing Instructions

All security features are continuously validated through an automated test suite located at `backend/test/security.test.ts`.

To run the complete test suite:
```bash
cd backend
npm test
```

To run only the security test suite:
```bash
cd backend
npx tsx --test test/security.test.ts
```

To verify type safety and production build:
```bash
npm run type-check
npm run build
```

---

## 10. Known Limitations & Future Roadmap

1. **In-Memory Rate Limiting:** The current rate limiters utilize the default memory store. In a multi-node horizontal deployment behind a load balancer, rate limits should be backed by a centralized Redis cluster via `rate-limit-redis`.
2. **Reverse Proxy IP Trust:** When deploying behind cloud load balancers (AWS ALB, Cloudflare, NGINX), `app.set('trust proxy', 1)` (or trusted subnet masks) should be configured to ensure `req.ip` correctly resolves the client IP from `X-Forwarded-For`.
3. **Refresh Token Rotation:** Currently, sessions rely on short-to-medium lived JWT cookies. Introducing a persistent refresh token rotation mechanism with database-backed token family invalidation is planned for future authentication enhancements.
