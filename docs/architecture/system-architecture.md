# System Architecture — SkillOrbit AI

> Phase 1.3 · Architecture & Design System Documentation

---

## 1. Overview

SkillOrbit AI is an AI-powered Career Development & Opportunity Platform built on a classic **three-tier architecture**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Tier 1 — Presentation                         │
│          React 19 · TypeScript · Vite 8 · React Router 7            │
│          react-hook-form · Zod · Axios · lucide-react               │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS REST (JSON)
                             │ Authorization: Bearer <JWT>
┌────────────────────────────▼─────────────────────────────────────────┐
│                        Tier 2 — Application                          │
│            Node.js · Express 4 · TypeScript · ESM                   │
│                                                                       │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  Routes  │→ │ Controllers │→ │    Services   │→ │  AI Layer   │  │
│  └──────────┘  └──────┬──────┘  └───────────────┘  │  (OpenAI)  │  │
│                        │                             └─────────────┘  │
│  ┌─────────────────────▼──────────────────────────────────────────┐  │
│  │        Middlewares: helmet · cors · morgan · auth · error      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              Mongoose ODM · Zod Validators · JWT                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ MongoDB Wire Protocol (TLS)
┌────────────────────────────▼─────────────────────────────────────────┐
│                        Tier 3 — Data                                  │
│                      MongoDB Atlas (Cloud)                            │
│            Collections: users · jobs · applications                  │
│              courses · skills · notifications (planned)              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend

| Concern | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | ~5.9 |
| Build Tool | Vite | 8 |
| Routing | React Router DOM | 7 |
| Forms | react-hook-form + Zod | 7 / 4 |
| HTTP Client | Axios | 1.x |
| Icons | lucide-react | 1.x |
| Linting | ESLint + typescript-eslint | 10 / 8 |

### Backend

| Concern | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM) | — |
| Framework | Express | 4 |
| Language | TypeScript | 5.9 |
| Database ODM | Mongoose | 8 |
| Auth | jsonwebtoken + bcryptjs | 9 / 2 |
| Validation | Zod | 4 |
| Security | helmet + cors + express-rate-limit | — |
| File Upload | multer | 2 |
| Logging | morgan | 1 |
| Build | tsc / tsx watch | — |

### Infrastructure

| Concern | Technology |
|---|---|
| Database | MongoDB Atlas |
| AI Provider | OpenAI API (planned) |
| Environment | dotenv |

---

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| SPA vs SSR | React SPA | Role-specific dashboards, no SEO requirement for authenticated views |
| Monorepo layout | `/frontend` + `/backend` under one root | Shared git history; independent `package.json` per concern |
| Module system | ESM (`"type":"module"`) on both sides | Modern, tree-shakeable, consistent |
| Auth strategy | Stateless JWT (Bearer token) | Horizontally scalable; no server-side session store needed |
| Password hashing | bcryptjs (cost 12) | Configurable work factor; pure-JS, no native bindings |
| Validation | Zod on both frontend and backend | Single schema language; runtime + compile-time safety |
| ODM | Mongoose 8 | Mature schema layer, virtuals, pre-save hooks, TypeScript generics |
| AI integration | Service layer (`services/ai/`) | Decoupled from controllers; swap provider without route changes |
| Security headers | helmet | Sane defaults; no manual header management |
| Rate limiting | express-rate-limit | Brute-force / DDoS mitigation on auth endpoints |

---

## 4. User Roles & Access Model

| Role | Key | Default | Description |
|---|---|---|---|
| Job Seeker | `seeker` | ✅ (default) | Browse jobs, apply, track applications, receive AI career guidance |
| Employer | `employer` | — | Post jobs, manage listings, review applicants |
| Training Provider | `provider` | — | Publish courses, manage enrollments, track learner progress |
| Admin | `admin` | — | Platform oversight, user management, analytics |

Role is stored on the `users` collection and read from the JWT payload on every protected request.

---

## 5. Authentication Flow

```
Client                        Backend                     Database
  │                              │                            │
  │── POST /api/auth/register ──▶│                            │
  │                              │── validate body (Zod) ───▶│
  │                              │── hash password (bcrypt) ─▶│
  │                              │── User.create() ──────────▶│
  │◀─── 201 { token, user } ────│                            │
  │                              │                            │
  │── POST /api/auth/login ─────▶│                            │
  │                              │── User.findOne(email) ────▶│
  │                              │◀──── user document ────────│
  │                              │── matchPassword() check    │
  │                              │── generateToken(userId)    │
  │◀─── 200 { token, user } ────│                            │
  │                              │                            │
  │── GET /api/users/me ────────▶│                            │
  │   Authorization: Bearer …    │── protect middleware        │
  │                              │── jwt.verify()             │
  │                              │── User.findById(userId) ──▶│
  │◀─── 200 { user } ───────────│                            │
```

---

## 6. Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP listen port | `5000` |
| `NODE_ENV` | Runtime environment | `development` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Token signing secret | min 32-char random string |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `OPENAI_API_KEY` | OpenAI key (AI features) | `sk-...` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## 7. Project Root Structure

```
skillorbit-ai/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   └── ui/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── employer/
│   │   │   ├── provider/
│   │   │   └── seeker/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── backend/                # Express API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── ai/
│   │   ├── types/
│   │   ├── utils/
│   │   └── validators/
│   └── package.json
├── docs/                   # Architecture & API documentation
│   ├── api/
│   ├── architecture/
│   └── database/
└── package.json            # Workspace root (dev scripts)
```
