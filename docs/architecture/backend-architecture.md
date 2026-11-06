# Backend Architecture — SkillOrbit AI

> Phase 1.3 · Architecture & Design System Documentation

---

## 1. Technology Stack

| Concern | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM) | LTS |
| Framework | Express | 4.x |
| Language | TypeScript | 5.9 |
| ODM | Mongoose | 8.x |
| Database | MongoDB Atlas | — |
| Auth | jsonwebtoken | 9.x |
| Password | bcryptjs | 2.x |
| Validation | Zod | 4.x |
| Security | helmet, cors, express-rate-limit | — |
| File Upload | multer | 2.x |
| Logging | morgan | 1.x |
| Environment | dotenv | 16.x |
| Build | tsc + tsx (watch) | — |

---

## 2. Project Structure

```
backend/src/
├── app.ts              # Express application factory (middleware + routes)
├── server.ts           # HTTP server bootstrap (DB connect, listen)
├── config/
│   ├── constants.ts    # Environment variable exports (PORT, JWT_SECRET, etc.)
│   └── db.ts           # Mongoose connection setup
├── controllers/
│   ├── auth.controller.ts   # register, login, logout, refreshToken
│   └── user.controller.ts   # getProfile, updateProfile, deleteAccount
├── middlewares/
│   ├── auth.middleware.ts   # protect (JWT guard), restrictTo (role guard)
│   └── error.middleware.ts  # Global error handler
├── models/
│   └── user.model.ts        # IUser interface + Mongoose schema
├── routes/
│   ├── auth.routes.ts       # POST /auth/register, POST /auth/login
│   └── user.routes.ts       # GET /users/me (protected)
├── services/
│   └── ai/
│       └── ai.service.ts    # analyzeResume, getSkillGap, getJobMatches
├── types/
│   └── express.d.ts         # Express Request augmentation (userId, user)
├── utils/
│   └── token.util.ts        # generateToken(userId) → JWT string
└── validators/
    └── auth.validator.ts    # Zod schemas for register and login bodies
```

---

## 3. Layered Architecture

```
HTTP Request
      │
      ▼
  ┌─────────────────────────────────┐
  │          Middleware Stack        │
  │  helmet → cors → json → morgan  │
  └────────────────┬────────────────┘
                   │
      ▼
  ┌─────────────────────────────────┐
  │             Router               │
  │  /api/auth/*  /api/users/*      │
  └────────────────┬────────────────┘
                   │
      ▼
  ┌─────────────────────────────────┐
  │    Auth Middleware (protect)     │
  │  JWT verify → req.userId        │
  └────────────────┬────────────────┘
                   │
      ▼
  ┌─────────────────────────────────┐
  │         Controller               │
  │  Validates input (Zod)           │
  │  Calls Model / Service           │
  │  Returns JSON response           │
  └────────────────┬────────────────┘
                   │
      ▼
  ┌─────────────────────────────────┐
  │     Model (Mongoose)             │
  │  Schema validation               │
  │  Pre-save hooks (bcrypt)         │
  │  CRUD operations                 │
  └────────────────┬────────────────┘
                   │
      ▼
  ┌─────────────────────────────────┐
  │         MongoDB Atlas            │
  └─────────────────────────────────┘
```

---

## 4. Middleware Stack

Middlewares are applied in [`app.ts`](../../backend/src/app.ts) in the following order:

| Order | Middleware | Purpose |
|---|---|---|
| 1 | `helmet()` | Security headers (CSP, HSTS, X-Frame-Options, etc.) |
| 2 | `cors({ origin: CLIENT_URL })` | Allow only the configured frontend origin |
| 3 | `express.json()` | Parse JSON request bodies |
| 4 | `express.urlencoded()` | Parse URL-encoded form data |
| 5 | `morgan('dev')` | HTTP request logging |
| 6 | `express-rate-limit` | Per-IP rate limiting on auth routes (planned) |
| 7 | `protect` (route-level) | JWT verification on protected routes |
| 8 | `errorMiddleware` (global, last) | Centralised error formatting |

---

## 5. Authentication & Authorisation

### 5.1 Token Generation

[`token.util.ts`](../../backend/src/utils/token.util.ts)

```typescript
export const generateToken = (userId: string): string =>
  jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
```

- Payload: `{ id: string }` (MongoDB `_id` as string)
- Secret: `JWT_SECRET` env var (fallback `"changeme"` — **must be overridden in production**)
- Expiry: `JWT_EXPIRES_IN` env var (default `"7d"`)

### 5.2 protect Middleware

[`auth.middleware.ts`](../../backend/src/middlewares/auth.middleware.ts)

1. Reads `Authorization: Bearer <token>` header.
2. Calls `jwt.verify(token, JWT_SECRET)` — throws on invalid/expired tokens.
3. Attaches `decoded.id` as `req.userId` for downstream controllers.
4. Returns `401` on missing or invalid token.

### 5.3 Role Guard (planned — `restrictTo`)

```typescript
export const restrictTo = (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ message: 'Forbidden – insufficient role' });
    }
    next();
  };
```

Used as: `router.delete('/users/:id', protect, restrictTo('admin'), deleteUser)`

---

## 6. Controllers

### auth.controller.ts

| Handler | Method | Route | Description |
|---|---|---|---|
| `register` | POST | `/api/auth/register` | Validate body → hash password → create user → return JWT |
| `login` | POST | `/api/auth/login` | Find user → matchPassword → generate JWT |

### user.controller.ts

| Handler | Method | Route | Auth |
|---|---|---|---|
| `getProfile` | GET | `/api/users/me` | protect |
| `updateProfile` | PUT | `/api/users/me` | protect (planned) |

---

## 7. Models

### User Model

**File:** [`models/user.model.ts`](../../backend/src/models/user.model.ts)

```
Collection: users
Interface:  IUser extends Document
```

| Field | Mongoose Type | Constraints |
|---|---|---|
| `name` | String | required, trim |
| `email` | String | required, unique, lowercase |
| `password` | String | required, minlength: 8 |
| `role` | String (enum) | `seeker \| employer \| provider \| admin`, default: `seeker` |
| `createdAt` | Date | auto (timestamps: true) |
| `updatedAt` | Date | auto (timestamps: true) |

**Hooks:**
- `pre('save')` — bcrypt hash password if modified (cost factor: 12)

**Methods:**
- `matchPassword(enteredPassword)` — bcrypt.compare, returns boolean

---

## 8. Planned Models (Phase 2+)

| Model | Collection | Key Relations |
|---|---|---|
| `Job` | `jobs` | `employer` → users |
| `Application` | `applications` | `seeker` → users, `job` → jobs |
| `Course` | `courses` | `provider` → users |
| `Enrollment` | `enrollments` | `learner` → users, `course` → courses |
| `SkillProfile` | `skill_profiles` | `user` → users |
| `Notification` | `notifications` | `recipient` → users |

---

## 9. AI Service Layer

**File:** [`services/ai/ai.service.ts`](../../backend/src/services/ai/ai.service.ts)

The AI service is intentionally isolated from controllers, allowing the underlying provider (OpenAI, Azure OpenAI, etc.) to be swapped without touching routes or controllers.

| Function | Signature | Status |
|---|---|---|
| `analyzeResume` | `(resumeText: string) → Promise<Record<string, unknown>>` | Stub |
| `getSkillGap` | `(userSkills: string[], jobRequirements: string[]) → Promise<string[]>` | Stub |
| `getJobMatches` | `(userId: string) → Promise<Job[]>` | Planned |
| `generateCareerPlan` | `(userId: string) → Promise<CareerPlan>` | Planned |

**Planned integrations:**
- OpenAI Chat Completions API (career advice, gap analysis)
- OpenAI Embeddings API (semantic job matching)
- File parsing: PDF resume text extraction via multer + pdf-parse

---

## 10. Validators

**File:** [`validators/auth.validator.ts`](../../backend/src/validators/auth.validator.ts)

Planned Zod schemas:

```typescript
// Register
export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['seeker', 'employer', 'provider']).optional(),
});

// Login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

---

## 11. Error Handling

**File:** [`middlewares/error.middleware.ts`](../../backend/src/middlewares/error.middleware.ts)

Planned global error handler (registered last in `app.ts`):

```typescript
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any).statusCode ?? 500;
  res.status(status).json({
    success: false,
    message: err.message ?? 'Internal Server Error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});
```

---

## 12. Configuration & Environment

**File:** [`config/constants.ts`](../../backend/src/config/constants.ts)

| Export | Env Var | Default | Notes |
|---|---|---|---|
| `PORT` | `PORT` | `5000` | HTTP listen port |
| `NODE_ENV` | `NODE_ENV` | `development` | Controls logging, error detail |
| `JWT_SECRET` | `JWT_SECRET` | `changeme` | **Override in production** |
| `JWT_EXPIRES_IN` | `JWT_EXPIRES_IN` | `7d` | Token lifetime |

**File:** [`config/db.ts`](../../backend/src/config/db.ts)

Mongoose connection using `MONGODB_URI` env var. Connects before `server.ts` starts listening.

---

## 13. Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Development server with hot reload |
| `build` | `tsc` | Compile to `dist/` |
| `start` | `node dist/server.js` | Production server |
