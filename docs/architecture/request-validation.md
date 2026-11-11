# Request Validation — SkillOrbit AI

> Phase 1.9.2 · Shared Zod request-boundary validation

## Purpose and Scope

Untrusted request parts must be parsed at the route boundary before controller execution. The backend uses the existing Zod dependency and the reusable `validateRequest()` middleware in `backend/src/middlewares/validate-request.middleware.ts`. No business-module schemas are added until those endpoints exist.

## Middleware Responsibilities

`validateRequest(schemas, message?)` accepts any combination of `body`, `params`, and `query` schemas:

- Calls each schema's `safeParse()` and aggregates issues across configured request parts.
- Returns HTTP 400 with the shared error envelope and the existing top-level field-error placement: `{ success: false, message, code: "VALIDATION_ERROR", errors: [{ field, message }] }`.
- Does not include raw submitted values, stack traces, or internal exception details in validation errors. Unknown strict-object keys receive a generic `Unrecognized field` message.
- Commits parsed/normalized request values only if every configured schema succeeds. If any part fails, no parsed request part is committed and `next()` is not called.
- On success, replaces the corresponding Express request property with the schema output, so downstream handlers consume normalized/coerced values.
- Does not perform database/business validation, authorization, or centralized error-handler work. It uses the shared error-response helper for the already-agreed validation error shape.

The `field` value is the Zod issue path joined with dots; for an unrecognized object key, it is the key name. Errors are ordered by request part (`body`, `params`, `query`) and then schema issue order.

## Schema Organization and Authentication

Keep schemas with the feature's validators. Authentication schemas and inferred input types remain in `backend/src/validators/auth.validator.ts`. That module exports the existing route middleware names (`validateRegistration`, `validateLogin`, `validatePasswordResetRequest`, `validatePasswordReset`, `validateEmailVerification`, and `validateResendVerification`); each delegates to `validateRequest({ body: schema }, existingMessage)`. Existing auth constraints, normalized email values, HTTP status, message strings, and downstream controller contracts are preserved.

## Usage

For an existing or future route, import the feature schema and compose validation before the controller:

- Body: `validateRequest({ body: createSchema })`
- Route params: `validateRequest({ params: idParamsSchema })`
- Query: `validateRequest({ query: listQuerySchema })`
- Multiple parts: `validateRequest({ params: idParamsSchema, query: listQuerySchema })`

Schemas should explicitly describe accepted fields. Use `.strict()` where unexpected fields must be rejected (as current auth payloads require). Normalize/coerce only intentionally, and type public controller inputs from `z.infer<typeof schema>` where a route needs feature-specific static types. Add route-param/query types alongside that module's schemas rather than creating schemas for unimplemented endpoints.

## Test and Integration Guidance

Run `npm test` from `backend/`; middleware coverage is in `backend/test/request-validation.test.ts`, and route-level auth compatibility is checked by `backend/test/api-architecture.test.ts`. Tests cover valid parsing/normalization, body/params/query, missing and malformed fields through auth schemas, strict extra keys, multiple errors, unchanged request data on failure, and no downstream handler execution.

## Later Phase Boundaries

- Phase 1.9.3 standardizes the envelope while retaining the existing top-level validation `errors` array for compatibility.
- Phase 1.9.4 owns centralized application error handling; schema failures remain direct HTTP 400 validation responses here.
