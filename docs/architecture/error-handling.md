# Error Handling — SkillOrbit AI

> Phase 1.9.4 · Centralized Express error pipeline

## ApplicationError

Use `ApplicationError` from `backend/src/utils/application-error.ts` for expected operational failures. It contains an HTTP `statusCode`, safe human-readable `message`, stable machine-readable `code`, optional field-level `errors`, and an `operational` flag (defaults to `true`). Use only safe, intentionally authored client messages. Unexpected failures should remain ordinary errors or use `operational: false`; clients receive a generic 500 response.

Example intent: `new ApplicationError('Email already in use', { statusCode: 409, code: 'EMAIL_IN_USE' })`. Do not include passwords, tokens, database values, connection strings, or other sensitive values in the message or field errors.

## Central error middleware

`backend/src/middlewares/error.middleware.ts` normalizes known errors into the Phase 1.9.3 response format using the shared `sendError()` helper:

| Error | HTTP status | Response code / policy |
|---|---:|---|
| `ApplicationError` (operational) | supplied 4xx/5xx status | supplied safe code/message/errors; non-operational or 5xx AppErrors become generic 500 |
| Zod error | 400 | `VALIDATION_ERROR`; field names retained, values/messages replaced with safe generic text |
| Mongoose `ValidationError` | 400 | `VALIDATION_ERROR`; field names and generic `Invalid value` messages |
| Mongo duplicate-key error (`11000`) | 409 | `DUPLICATE_KEY`; index field names only, never duplicate values |
| Mongoose `CastError` | 400 | `INVALID_ID`; generic message |
| JWT expired/invalid/not-before error | 401 | `INVALID_AUTHENTICATION`; generic messages |
| Express/body-parser malformed or oversized body | 400/413 | `MALFORMED_REQUEST` / `PAYLOAD_TOO_LARGE` |
| Unknown/unexpected error | 500 | `INTERNAL_SERVER_ERROR`; generic message, no stack or error detail |

Unknown raw errors with status properties do not have their message/code reflected to clients. If `res.headersSent` is already true, the middleware delegates to Express with `next(error)` and does not attempt another response.

Unexpected errors are logged with only HTTP method, URL path (not query string), error class name, and normalized code. Morgan uses a custom path token that strips the query portion from `req.url`. Error messages, stacks, request bodies, headers, cookies, credentials, and token values are not logged. The active database connector and server startup/shutdown paths also log database error class names only, not raw driver messages.

## Async error forwarding (Express 4)

The runtime uses Express 4, which does not automatically forward rejected route-handler promises. Use `asyncHandler()` from `backend/src/middlewares/async-handler.middleware.ts` for async route handlers/middleware. It attaches a rejection handler and calls `next(error)`. Existing controllers that retain `try/catch` for local decisions (for example mapping registration duplicate-key errors) may continue forwarding with `next(error)`; the route wrapper is a safety net, not a replacement for endpoint-specific behavior. Do not rely on Express 5 promise forwarding while the runtime dependency is Express 4.

## Middleware order

The existing order remains:

1. Helmet, CORS, JSON/url-encoded parsing, cookie parsing.
2. Morgan and global request limiter.
3. API routes (including route validation/auth/rate limits).
4. Not-found middleware.
5. Central error middleware, last.

Errors after headers are sent are delegated to Express. The 404 middleware handles unmatched routes as an ordinary standardized 404 response before the error middleware.

## Response format and examples

Operational error:

```json
{
  "success": false,
  "message": "Email already in use",
  "code": "EMAIL_IN_USE"
}
```

Validation error:

```json
{
  "success": false,
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Invalid value" }]
}
```

Unexpected failure:

```json
{
  "success": false,
  "message": "Internal Server Error",
  "code": "INTERNAL_SERVER_ERROR"
}
```

## Future modules

- Raise `ApplicationError` for expected domain/request failures, with appropriate HTTP status, stable code, safe message and optional field errors.
- Let unexpected failures propagate to the central middleware; do not send ad hoc 500 responses from controllers.
- For Zod schemas, prefer route-boundary `validateRequest()` so invalid input is rejected before controllers. The central Zod mapper is a fallback for thrown Zod errors.
- Use async route wrappers for Promise-returning handlers on Express 4.
- Never log raw request data or error stacks in application logs; redact secrets in any future observability integration.
- Keep status/body contract tests alongside route tests. Tests run via `npm test` in `backend/`.

## Known limitations

Tests use Node's built-in runner and mocked persistence/transport; they do not prove live MongoDB/SMTP behavior. Operational server logs intentionally omit stack traces, so production diagnosis requires a future redacted/correlated observability strategy. Centralized error middleware is generic and does not yet include request IDs or domain-specific error taxonomies beyond the codes documented above.
