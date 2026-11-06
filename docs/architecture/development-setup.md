# Development Setup — SkillOrbit AI

> Phase 1.5 · Technology Stack & Environment Configuration

---

## 1. Prerequisites

| Tool | Minimum Version | Check |
|---|---|---|
| Node.js | 18 LTS | `node --version` |
| npm | 9 | `npm --version` |
| Git | 2.x | `git --version` |
| MongoDB Atlas account | — | atlas.mongodb.com |

---

## 2. First-Time Setup

### 2.1 Clone the repository

```bash
git clone <repository-url>
cd skillorbit-ai
```

### 2.2 Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 2.3 Install backend dependencies

```bash
cd backend
npm install
cd ..
```

### 2.4 Install workspace-root dependencies (Tailwind CSS)

```bash
# From the skillorbit-ai root
npm install
```

### 2.5 Configure backend environment

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in the required values:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=<generate a random string of at least 32 characters>
```

All other variables have working defaults for local development.

### 2.6 Configure frontend environment

```bash
cd frontend
cp .env.example .env.local
```

The default `VITE_API_BASE_URL=http://localhost:5000/api` works without changes for local development.

---

## 3. Running in Development

Open two terminal windows:

**Terminal 1 — Backend (hot reload):**

```bash
cd backend
npm run dev
```

Expected output:

```
[env] AI_PROVIDER and/or AI_API_KEY are not set. AI features will be unavailable.
[db] MongoDB connected — host: <cluster-host>
[server] SkillOrbit AI running on port 5000 (development)
```

**Terminal 2 — Frontend (Vite HMR):**

```bash
cd frontend
npm run dev
```

Expected output:

```
  VITE v8.x.x  ready in ...ms
  ➜  Local:   http://localhost:5173/
```

---

## 4. Scripts Reference

### Frontend (`frontend/`)

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start Vite dev server with HMR |
| `build` | `tsc -b && vite build` | TypeScript check + production bundle |
| `preview` | `vite preview` | Serve the production build locally |
| `lint` | `eslint .` | Run ESLint across `src/` |

### Backend (`backend/`)

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Development server with hot reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/server.js` | Run compiled production server |

---

## 5. Production Deployment

### 5.1 Build

```bash
# Frontend
cd frontend && npm run build
# Output: frontend/dist/

# Backend
cd backend && npm run build
# Output: backend/dist/
```

### 5.2 Environment

Set the following in your production environment (e.g. Render, Railway, AWS):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Port assigned by platform (or `5000`) |
| `CLIENT_URL` | Deployed frontend URL (e.g. `https://app.skillorbit.ai`) |
| `MONGODB_URI` | Atlas production cluster URI |
| `JWT_SECRET` | A long random secret (use a password manager to generate) |
| `JWT_EXPIRES_IN` | `7d` or shorter |
| `AI_PROVIDER` | (when AI is activated) |
| `AI_API_KEY` | (when AI is activated) |

### 5.3 Start

```bash
cd backend
npm run start
```

---

## 6. Project Structure Quick Reference

```
skillorbit-ai/
├── frontend/               # Vite + React SPA
│   ├── src/
│   │   ├── components/     # UI, layout, common components
│   │   ├── pages/          # Role-specific page components
│   │   ├── services/       # api.ts Axios instance + service modules
│   │   ├── context/        # React Context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── routes/         # Route definitions and guards
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Pure helper functions
│   ├── .env.example        # Frontend env template
│   └── vite.config.ts
│
├── backend/                # Express REST API
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts      # Environment variable validation
│   │   │   ├── constants.ts # Typed constant exports
│   │   │   ├── database.ts # MongoDB Atlas connection
│   │   │   └── db.ts       # Legacy (superseded by database.ts)
│   │   ├── controllers/    # Route handler functions
│   │   ├── middlewares/    # auth, error handlers
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # Express routers
│   │   ├── services/ai/    # AI service layer (stubs)
│   │   ├── types/          # Express type augmentation
│   │   ├── utils/          # token.util.ts etc.
│   │   ├── validators/     # Zod schemas
│   │   ├── app.ts          # Express factory (middleware + routes)
│   │   └── server.ts       # HTTP server bootstrap
│   ├── .env.example        # Backend env template
│   └── tsconfig.json
│
├── docs/                   # Architecture and API documentation
├── package.json            # Workspace root (Tailwind CSS)
└── .gitignore
```

---

## 7. API Health Check

Once both services are running, verify the backend:

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "SkillOrbit AI API is running!",
  "environment": "development"
}
```

---

## 8. Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `[env] FATAL: Required environment variable "MONGODB_URI" is missing` | `.env` not created | Run `cp .env.example .env` and add your Atlas URI |
| `[env] FATAL: Required environment variable "JWT_SECRET" is missing` | JWT_SECRET not set | Add a random string to `backend/.env` |
| `[db] FATAL: MongoDB connection failed` | Wrong URI or IP not allowlisted | Check Atlas network access (allow `0.0.0.0/0` for dev or your IP) |
| Frontend shows blank page | Vite env var not set | Ensure `frontend/.env.local` has `VITE_API_BASE_URL` |
| CORS error in browser | `CLIENT_URL` mismatch | Ensure backend `CLIENT_URL` matches the Vite dev server URL |
| `tsx: command not found` | tsx not installed | Run `npm install` inside `backend/` |
| Tailwind classes not applying | Tailwind plugin not loaded | Ensure `@import "tailwindcss"` is in `src/index.css` |

---

## 9. Generating a JWT Secret

Use one of these methods to generate a secure `JWT_SECRET`:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# PowerShell (Windows)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```
