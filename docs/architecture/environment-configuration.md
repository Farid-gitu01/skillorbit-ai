# Environment Configuration — SkillOrbit AI

> Phase 1.5 · Technology Stack & Environment Configuration

---

## 1. Principles

| Principle | Rule |
|---|---|
| Secret separation | Database credentials, JWT secrets, and AI keys are backend-only |
| Prefix rule | Only `VITE_`-prefixed variables are embedded in the browser bundle |
| No committed secrets | `.env` files are listed in `.gitignore`; only `.env.example` is committed |
| Fail-fast | Missing required variables crash the server at startup with a clear message |
| No hardcoded fallbacks | No insecure fallback values in source code (e.g. no `'changeme'`) |

---

## 2. Frontend Environment Variables

**File:** `frontend/.env.example`  
**Runtime:** Injected by Vite at build time via `import.meta.env`  
**Gitignore:** Covered by root `.gitignore` — `.env`, `.env.*` except `.env.example`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | — | `http://localhost:5000/api` | Backend REST API base URL |

**Usage in code:**

```typescript
// frontend/src/services/api.ts
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';
```

**Rules:**
- Only variables prefixed with `VITE_` are accessible in the browser.
- Never put `JWT_SECRET`, `MONGODB_URI`, `AI_API_KEY`, or any backend secret in frontend env vars.

---

## 3. Backend Environment Variables

**File:** `backend/.env.example`  
**Loaded by:** `import 'dotenv/config'` at the top of `server.ts`  
**Validated by:** `backend/src/config/env.ts`

### 3.1 Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | — | `5000` | HTTP listen port |
| `NODE_ENV` | — | `development` | Runtime environment (`development \| production \| test`) |
| `CLIENT_URL` | — | `http://localhost:5173` | Allowed CORS origin (frontend URL) |
| `MONGODB_URI` | ✅ | — | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | — | JWT signing secret (min 32 random characters recommended) |
| `JWT_EXPIRES_IN` | — | `7d` | JWT token lifetime (e.g. `7d`, `24h`, `3600`) |
| `SMTP_HOST` | Production | — | SMTP server hostname; development may omit the complete SMTP configuration |
| `SMTP_PORT` | Production | — | SMTP server port, integer from 1 to 65535 |
| `SMTP_SECURE` | — | Port-derived | `true` for implicit TLS (typically 465), `false` for STARTTLS (typically 587) |
| `SMTP_USER` | Production | — | SMTP authentication username; backend-only secret/configuration |
| `SMTP_PASS` | Production | — | SMTP authentication password; backend-only secret |
| `EMAIL_FROM` | Production | — | Verified sender address/name used for application mail |
| `AI_PROVIDER` | — | — | AI provider identifier (`openai \| azure-openai \| anthropic \| custom`) |
| `AI_API_KEY` | — | — | API key for the AI provider |

### 3.2 Required vs Optional

| Variable | Status | Behaviour if absent |
|---|---|---|
| `MONGODB_URI` | **Required** | `process.exit(1)` with clear error message |
| `JWT_SECRET` | **Required** | `process.exit(1)` with clear error message |
| `PORT` | Optional | Defaults to `5000` |
| `NODE_ENV` | Optional | Defaults to `development` |
| `CLIENT_URL` | Optional | Defaults to `http://localhost:5173` |
| `JWT_EXPIRES_IN` | Optional | Defaults to `7d` |
| SMTP settings | Production required; development optional as a complete set | Production startup fails if required SMTP host, port, user, password, or sender is absent/invalid; a partial development configuration also fails |
| `AI_PROVIDER` | Optional | Warning logged; AI features unavailable |
| `AI_API_KEY` | Optional | Warning logged; AI features unavailable |

### 3.3 Environment Validation (`env.ts`)

**File:** `backend/src/config/env.ts`

The `env.ts` module runs synchronously when first imported in `server.ts` (before database connect or `app.listen`). It:

1. Reads `process.env` (populated by `dotenv/config`)
2. Asserts required variables are present and non-empty
3. Parses `PORT` as an integer within a valid range
4. Normalises `NODE_ENV` to a known value
5. Validates SMTP configuration (optional as a complete set in development; required in production)
6. Exports a typed `env` object used by `constants.ts`

```
[env] FATAL: Required environment variable "MONGODB_URI" is missing or empty.
```

No credentials or values are printed in error or warning messages.

### 3.4 Email Delivery

The backend uses Nodemailer with SMTP. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` on the backend only. `SMTP_SECURE` is optional and defaults to `true` on port 465 and `false` on other ports. Production requires SMTP configuration at startup; development may omit all SMTP variables, in which case delivery is unavailable and the API does not claim that mail was sent. A partial SMTP configuration fails startup. SMTP secrets must never use a `VITE_` prefix, be committed, logged, or returned to the browser.

---

## 4. Frontend–Backend Environment Separation

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Vite)                    │
│  VITE_API_BASE_URL — injected at build time          │
│  ✗ JWT_SECRET  ✗ MONGODB_URI  ✗ AI_API_KEY           │
└─────────────────────────────────────────────────────┘
                           │ HTTPS
┌─────────────────────────────────────────────────────┐
│                   Backend (Node.js)                  │
│  PORT, NODE_ENV, CLIENT_URL                          │
│  MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN             │
│  SMTP_HOST/PORT/USER/PASS, EMAIL_FROM (backend-only)  │
│  AI_PROVIDER, AI_API_KEY                             │
│  All validated at startup via env.ts                 │
└─────────────────────────────────────────────────────┘
```

---

## 5. MongoDB Atlas Connection

**File:** `backend/src/config/database.ts`

| Setting | Value |
|---|---|
| Connection source | `MONGODB_URI` environment variable |
| Pool size | `maxPoolSize: 10` |
| Server selection timeout | `5000 ms` |
| Socket timeout | `45000 ms` |
| Duplicate connection guard | Checked via `isConnected` flag |
| Failed connection | `process.exit(1)` |
| Credentials in logs | Never — only `mongoose.connection.host` is logged |

**Startup log (success):**

```
[db] MongoDB connected — host: cluster0-shard-00-00.mongodb.net
```

**Startup log (failure):**

```
[db] FATAL: MongoDB connection failed — <non-credential error message>
```

---

## 6. AI Integration Configuration Plan

AI credentials are stored in backend environment variables only and are never passed to the frontend.

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Identifies which AI SDK/client to initialise (`openai`, `azure-openai`, `anthropic`, or `custom`) |
| `AI_API_KEY` | Authentication key for the selected provider |

**How to add a new AI provider (future Phase 3 instructions):**

1. Add the provider's SDK as a backend dependency (`npm install openai` inside `backend/`).
2. Set `AI_PROVIDER` and `AI_API_KEY` in `backend/.env`.
3. In `backend/src/services/ai/ai.service.ts`, read `AI_PROVIDER` from `constants.ts` and initialise the correct client.
4. Implement the `analyzeResume`, `getSkillGap`, and `getJobMatches` stubs.
5. The `env.ts` validation will warn (not crash) when AI vars are absent, so the server remains operational without AI credentials.

No AI SDK is installed or called in Phase 1.5.

---

## 7. Security Notes

| Concern | Mitigation |
|---|---|
| `JWT_SECRET` hardcoded fallback | Removed — startup fails if absent |
| Stack traces in production | Suppressed — `error.middleware.ts` hides `stack` when `NODE_ENV === 'production'` |
| Unrestricted CORS | Restricted to `CLIENT_URL` in production; list also includes `localhost:5173` in development only |
| Rate limiting | Global: 100 req/min; Auth routes: 20 req/15 min (successful requests skipped) |
| Body size | Limited to `10kb` for JSON and URL-encoded bodies |
| Security headers | `helmet()` middleware sets CSP, HSTS, X-Frame-Options, etc. |
