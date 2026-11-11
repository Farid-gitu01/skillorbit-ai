# API Response Structure — SkillOrbit AI

> Phase 1.9.3 · Standard response types and helpers

## Contract

Successful API responses use `success: true`, with optional `data`, `message`, and `meta`:

```json
{
  "success": true,
  "data": { "user": { "_id": "...", "name": "..." } },
  "message": "Request completed"
}
```

Message-only success responses omit `data`:

```json
{ "success": true, "message": "Logged out successfully" }
```

Paginated results place pagination fields in `meta`:

```json
{
  "success": true,
  "data": [{ "id": "..." }],
  "meta": { "page": 1, "limit": 20, "total": 142, "pages": 8 }
}
```

Errors use `success: false`, a safe human-readable `message`, and a stable machine-readable `code`; `errors` is optional and contains field-level validation issues:

```json
{
  "success": false,
  "message": "Login validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "A valid email address is required" }]
}
```

Do not return password hashes, JWTs, verification/reset tokens in production, stack traces, SMTP credentials, or internal exception details. Existing explicit development-only verification/reset tokens remain nested in `data` only when SMTP is unavailable and `NODE_ENV` is explicitly `development`.

## TypeScript contracts and helpers

- Types live in `backend/src/types/api-response.ts`: `ApiSuccessResponse<T, M>`, `ApiErrorResponse`, `ApiResponse<T, M>`, `ApiFieldError`, and `PaginationMeta`.
- Helpers live in `backend/src/utils/api-response.util.ts`:
  - `sendSuccess(res, status, data, message?)`
  - `sendCreated(res, data, message?)` (201)
  - `sendMessage(res, status, message)` for success without a `data` payload
  - `sendEmptySuccess` as the message-only success alias
  - `sendPaginated(res, status, data, meta, message?)`
  - `sendError(res, status, message, { code?, errors? })`
- Helpers only assemble HTTP response bodies/status; they contain no domain logic.
- Pass status codes explicitly except the dedicated `sendCreated` convenience helper. Optional fields are omitted when not supplied; no unnecessary `null` or empty `data` is emitted.

## HTTP status conventions

| Status | Typical use |
|---|---|
| `200` | Successful read/action or message-only success |
| `201` | Resource created (registration) |
| `204` | Reserved for an explicit no-body HTTP response; current APIs use message-only 200 responses where a body is required |
| `400` | Zod validation or invalid/expired one-time token |
| `401` | Missing/invalid authentication or invalid credentials |
| `403` | Authenticated but insufficient role |
| `404` | Unknown route/resource |
| `409` | Duplicate email |
| `429` | Rate limit; standard rate-limit headers remain enabled |
| `500` | Unexpected server error; response message is generic and excludes stack/internal details |
| `503` | Health dependency unavailable |

## Compatibility and migration decision

Existing URLs, cookie behavior, status codes, and core payloads remain unchanged. Auth controller payload fields remain under `data`; validation field errors remain a top-level `errors` array. The migration adds `code` to errors, nests health details in `data`, and uses `meta` (rather than the older proposed `pagination` name) for future pagination. The health payload was the one existing success response with fields outside `data`; this intentional response-contract change is documented here because no frontend endpoint consumer was found during the audit. The frontend Axios service returns raw Axios responses and does not currently unwrap payloads.

The legacy `docs/api/api-documentation.md` standard envelope is aligned with this contract. The 404 retains its existing method/path message. Existing validation messages and authentication outcomes remain intact. Error middleware keeps its existing registration/order and status-code selection; this phase standardizes its output only, not centralized error architecture (Phase 1.9.4).

## Endpoint and security notes

Auth success responses use `{ success, data?, message? }`; auth errors add `code`. Cookie setting/clearing is unchanged. Current routes do not implement general paginated endpoints; `sendPaginated` establishes a reusable future contract. Development-only verification/reset tokens remain in `data` only under the existing development-without-email condition; production responses never contain them.

## Error handling integration

Centralized normalization of operational, validation, database, JWT, parser, and unexpected errors is documented in [Error Handling](error-handling.md). The response helper remains the single serialization path for both explicit endpoint responses and the final error middleware.

## Verification

`backend/test/api-response.test.ts` tests success, created, message-only, error, and paginated helpers and optional-field omission. Route/auth tests verify validation, health, authentication, and 404 contracts. Run backend checks using `npm test`, `npm run type-check`, and `npm run build` in `backend/`.
