# API Architecture — SkillOrbit AI

> Phase 1.9.1 · API organization and compatibility strategy

## 1. Current Scope and Principles

The backend is an Express 4 application written in strict TypeScript using ESM/NodeNext, Mongoose, Zod, JWT, and HttpOnly cookies. The API currently exposes only the health, authentication, and current-user routes. This phase documents the architecture and verifies existing registration; it does not add placeholder business routes, alter authentication behavior, introduce API versioning, or standardize validation, response, or error behavior.

The existing structure is the source of truth. Keep the current layered directories, use explicit `.js` import suffixes in TypeScript imports, and add future module files only when that module is implemented.

## 2. Responsibilities and Boundaries

| Layer | Responsibility | Current convention |
|---|---|---|
| `routes/` | Map HTTP method/path to middleware and controller; compose public/protected routes and rate limits. | Route modules use Express `Router`; `routes/index.ts` mounts module routers. |
| `controllers/` | Translate Express request data to domain operations and HTTP status/body/cookies; pass unexpected errors to `next(error)`. | `auth.controller.ts` owns auth HTTP handling; `user.controller.ts` owns `/users/me`. Auth controllers currently access Mongoose directly in places; do not introduce a service layer solely for abstraction. |
| `services/` | Reusable business/integration operations independent of route composition. | `services/email/email.service.ts` owns SMTP transport and verification/reset mail composition; the AI service is isolated under `services/ai/`. Add a domain service when business logic/integrations merit reuse or separation. |
| `models/` | Mongoose schemas, persistence fields, model methods and hooks. | The existing model barrel registers/exports the models. Do not add a model or collection as a routing convenience. |
| `middlewares/` | Cross-cutting request processing such as authentication/authorization, not-found and error handling. | `protect` authenticates the cookie and loads safe current-user identity; `restrictTo` checks database-backed roles. |
| `validators/` | Own feature request schemas and inferred input types. | Auth schemas and route-level middleware wrappers are in `validators/auth.validator.ts`; wrappers use the shared `middlewares/validate-request.middleware.ts` for body, params, and query parsing. |
| `types/` | Shared Express request augmentation and other reusable TypeScript contracts. | `types/express.d.ts` adds safe user identity and role properties to `Request`. |
| `config/` | Validated environment, constants and infrastructure setup. | `env.ts` validates startup configuration; `database.ts` is the server connection path; `app.ts` configures Express. |
| `utils/` | Small reusable technical helpers, not HTTP routing or domain orchestration. | JWT, auth-cookie and one-time-token helpers live in `utils/`. |

### Controller/service boundary

Controllers are the HTTP adapters: read the typed/validated request, invoke the existing model or a service, and send a response. Services should own reusable domain workflows or external integrations; they should not import Express `Request`/`Response`. Models own persistence schema behavior. Keep the current direct model access where it already works; move logic only when a concrete reuse/testability need justifies it.

Async controllers should return `Promise<void>`, catch expected failures as appropriate, and pass unexpected errors to `next(error)` so the final error middleware can handle them. Routes should remain declarative and compose validation/auth/authorization in order before controller handlers.

## 3. Request Lifecycle

The current application middleware order is:

1. Helmet security headers.
2. CORS with explicit configured frontend origin(s) and credentials.
3. JSON and URL-encoded body parsing (10 KB limits).
4. Cookie parsing.
5. Morgan request logging.
6. Global per-IP rate limiter.
7. Central API router mounted at `/api`.
8. JSON 404 middleware for unmatched routes.
9. Error middleware, last.

Within the API router, health is public; auth routes receive the general auth limiter; user routes declare their own protection. Auth routes compose route-specific Zod validation before controllers and, for verification/reset actions, narrower rate limits. `validateRequest()` commits normalized body/params/query only after all configured schemas pass; failures return HTTP 400 and stop the chain. Protected routes use `protect` before any `restrictTo(...)` role guard. The guard reads only the role attached from the current database user, not client input or JWT claims.

## 4. Current Route Registration

`app.ts` mounts exactly one API router at `/api`. `routes/index.ts` centrally mounts only the implemented module routers. Keep this centralized registration pattern; new routers should be imported and mounted there only when they have real handlers.

| Method | Path | Access / behavior |
|---|---|---|
| `GET` | `/api/health` | Public health and database-readiness status. |
| `POST` | `/api/auth/register` | Public; registration validator and auth rate limit. |
| `POST` | `/api/auth/login` | Public; login validator and auth rate limit. |
| `POST` | `/api/auth/logout` | Public/idempotent cookie clearing; auth rate limit. |
| `POST` | `/api/auth/forgot-password` | Public; reset validator and dedicated reset limiter. |
| `POST` | `/api/auth/reset-password` | Public; reset validator and dedicated reset limiter. |
| `POST` | `/api/auth/verify-email` | Public; verification validator and dedicated verification limiter. |
| `POST` | `/api/auth/resend-verification` | Public; resend validator and dedicated verification limiter. |
| `GET` | `/api/users/me` | Protected by cookie-based `protect`; returns safe current-user projection. |

There are no mounted profile, organization, resume, skill, roadmap, course, job, application, notification, or admin resource routers yet. The corresponding models and documentation do not make those endpoints available. Unknown paths continue through the existing 404 middleware; do not mount empty routers or placeholder handlers.

## 5. Future Module Organization

When a module is implemented, use its own route/controller/validator/service files as appropriate and register the router in `routes/index.ts`. The following is a *future organizational map*, not a list of existing files or active endpoints:

| Module | Likely route mount | Current status |
|---|---|---|
| Auth | `/auth` | Implemented. |
| Users | `/users` | Implemented: protected `GET /me`. |
| Profiles | `/profiles` | No route module yet. |
| Organizations | `/organizations` | No route module yet. |
| Resumes | `/resumes` | No route module yet. |
| Skills | `/skills` | No route module yet. |
| Learning roadmaps | `/learning-roadmaps` | No route module yet. |
| Courses | `/courses` | No route module yet. |
| Jobs | `/jobs` | No route module yet. |
| Applications | `/applications` | No route module yet. |
| Notifications | `/notifications` | No route module yet. |
| Admin | `/admin` | No route module yet. |

Do not create business endpoints until their contract, controller/service behavior, validation and access policy are implemented.

## 6. Naming and HTTP Conventions

- Use plural resource nouns for collections (`/jobs`, `/courses`, `/applications`) and nested resource paths only where ownership/relationship is part of the API contract.
- Use HTTP methods for semantics: `GET` reads; `POST` creates or invokes explicit actions; `PUT`/`PATCH` updates; `DELETE` removes.
- Use kebab-case for multiword URL segments (for example `/learning-roadmaps`). Keep auth action routes such as `/forgot-password` explicit and stable.
- Keep route files focused on registration/composition; do not place persistence logic there.
- Use `validateRequest({ body, params, query })` before controllers for public/untrusted request parts as applicable; preserve validated schema output for the handler.
- Do not let client-supplied identity or role override authenticated request identity.

## 7. API Versioning and Compatibility

The public contract is currently unversioned under `/api`; frontend `VITE_API_BASE_URL` points to that prefix, and existing authentication integrations use `/api/auth/...` and `/api/users/me`. Phase 1.9.1 retains `/api` unchanged. Do **not** silently switch to `/api/v1` or rewrite existing links.

If a future breaking change requires versioning, first publish a migration plan, then mount a versioned router alongside the legacy router (for example, both `/api/auth` and `/api/v1/auth`) with shared controllers/services. Keep legacy paths during a documented deprecation window, update frontend configuration/clients deliberately, verify cookies/CORS and external consumers, and remove `/api` only in an explicitly approved breaking release. Avoid duplicate router implementations.

## 8. Authentication and Authorization Integration

- Auth endpoints remain public as listed in the route table; their validators and rate limits are attached at their route boundaries.
- `protect` reads only the `skillorbit_access` HttpOnly cookie, verifies it using the shared token utility, fetches the user, checks active/deleted state, and attaches safe identity/role data.
- `restrictTo(...roles)` is a separate middleware applied after `protect`; it supports multiple roles and produces 401 for missing authentication versus 403 for insufficient permission.
- No resource routes exist yet, so this phase assigns no new role policies. When resource endpoints are added, define both permitted roles and ownership checks from their intended use case; do not infer them from models alone.
- Cookie credentials and explicit-origin CORS remain part of the existing app setup. CORS alone is not CSRF protection; add Origin/CSRF controls before introducing cookie-authenticated state-changing business routes.

## 9. Later Phase Integration Points (not implemented here)

- **Phase 1.9.2 — Request validation:** implemented via shared `validateRequest()` middleware and integrated into existing authentication routes. Future module routes should reuse this middleware with feature-owned schemas.
- **Phase 1.9.3 — Response structure:** implemented with shared response types/helpers and integrated across controllers, health, validation, authentication/authorization, rate limits, 404, and the existing error middleware. See [API Response Structure](api-response-structure.md). Health detail fields are now nested under `data`; error responses add machine-readable `code`.
- **Phase 1.9.4 — Error handling:** implemented typed operational `ApplicationError`, safe mapping for Zod, Mongoose/MongoDB, JWT and Express parser errors, Express 4 async forwarding, sanitized unexpected-error logging, and already-sent response delegation. See [Error Handling](error-handling.md). Request correlation and domain-specific error taxonomies remain future observability work.

## 10. Verification and Test Coverage

Backend tests run with Node's built-in `node:test` through `tsx` using `npm test` from `backend/`. The suites cover auth behavior with mocked persistence/SMTP, API response helpers, route/health/validation/404 behavior, and request validation. `api-architecture.test.ts` starts the actual Express app on an ephemeral localhost port; it does not connect to MongoDB or send live email. Run backend checks with `npm run type-check` and `npm run build`; frontend compatibility can be checked with `npm run build`.
