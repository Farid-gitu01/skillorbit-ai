# Technology Stack — SkillOrbit AI

> Phase 1.5 · Technology Stack & Environment Configuration

---

## 1. Frontend

| Concern | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | 19.3 | Functional components + hooks |
| Language | TypeScript | ~5.9 | Strict mode |
| Build tool | Vite | 8.3 | ESM, HMR, rolldown bundler |
| CSS framework | Tailwind CSS | 4.3 | v4 via `@tailwindcss/vite` plugin |
| Routing | React Router DOM | 7.18 | File-based route organisation |
| Form handling | react-hook-form | 7.91 | + `@hookform/resolvers` |
| Schema validation | Zod | 4.6 | Shared frontend/backend |
| HTTP client | Axios | 1.21 | Centralised in `services/api.ts` |
| Icons | lucide-react | 1.68 | Tree-shakeable SVG icons |
| Linting | ESLint + typescript-eslint | 10 / 8 | React hooks + refresh plugins |

### Tailwind CSS v4 Configuration

Tailwind CSS v4 is installed at the **workspace root** (`skillorbit-ai/package.json`) and pulled into the frontend via the `@tailwindcss/vite` Vite plugin. There is no separate `tailwind.config.js` — v4 uses CSS-first configuration.

```typescript
// frontend/vite.config.ts
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

---

## 2. Backend

| Concern | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | LTS | ESM (`"type": "module"`) |
| Framework | Express | 4.22 | REST API |
| Language | TypeScript | 5.9 | `NodeNext` module resolution |
| Build | tsc | 5.9 | Output: `dist/` |
| Dev runner | tsx watch | 4.23 | Hot reload for development |
| ODM | Mongoose | 8.24 | MongoDB schema layer |
| Auth tokens | jsonwebtoken | 9.0 | Stateless JWT |
| Password hashing | bcryptjs | 2.4 | Cost factor 12 |
| Validation | Zod | 4.6 | Request body schemas |
| Security headers | Helmet | 8.3 | Sane CSP/HSTS defaults |
| CORS | cors | 2.8 | Restricted to `CLIENT_URL` |
| Rate limiting | express-rate-limit | 8.7 | Global + auth-route limiters |
| File uploads | multer | 2.5 | Resume uploads |
| Request logging | morgan | 1.12 | `dev` in dev, `combined` in prod |
| Environment | dotenv | 16.6 | `.env` file loading |

---

## 3. Database

| Concern | Technology | Notes |
|---|---|---|
| Database | MongoDB Atlas | Cloud-hosted |
| ODM | Mongoose 8 | TypeScript generics support |
| Connection | `MONGODB_URI` env var | Validated at startup |

---

## 4. Development Tools

| Tool | Purpose |
|---|---|
| ESLint | Code linting (frontend + backend) |
| typescript-eslint | TypeScript-aware lint rules |
| eslint-plugin-react-hooks | React hooks correctness |
| eslint-plugin-react-refresh | Vite HMR compatibility |
| tsx | TypeScript execution with hot reload |
| ts-node-dev | (installed, superseded by `tsx`) |

---

## 5. Planned Additions (Future Phases)

| Concern | Planned Technology | Phase |
|---|---|---|
| AI integration | Provider-configurable via `AI_PROVIDER` env var | Phase 3 |
| Testing | Vitest (frontend) + Jest or Vitest (backend) | Phase 2 |
| File storage | AWS S3 or compatible object store | Phase 2 |
| Email | Nodemailer + transactional email provider | Phase 2 |
| CI/CD | GitHub Actions | Phase 4 |
