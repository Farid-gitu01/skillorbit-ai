import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { validateRequest } from '../src/middlewares/validate-request.middleware.js';

function invokeMiddleware(
  middleware: ReturnType<typeof validateRequest>,
  request: Record<string, unknown>
) {
  const result: { statusCode?: number; payload?: unknown; nextCalled: boolean } = { nextCalled: false };
  const response = {
    status(statusCode: number) {
      result.statusCode = statusCode;
      return this;
    },
    json(payload: unknown) {
      result.payload = payload;
      return this;
    },
  };
  middleware(request as never, response as never, () => { result.nextCalled = true; });
  return result;
}

test('validates, normalizes, and replaces body, route params, and query data', () => {
  const request = {
    body: { email: '  USER@example.test ' },
    params: { userId: '507f1f77bcf86cd799439011' },
    query: { page: '3' },
  };
  const result = invokeMiddleware(validateRequest({
    body: z.object({ email: z.string().trim().toLowerCase().email() }).strict(),
    params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }).strict(),
    query: z.object({ page: z.coerce.number().int().positive() }).strict(),
  }), request);

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, undefined);
  assert.deepEqual(request.body, { email: 'user@example.test' });
  assert.deepEqual(request.params, { userId: '507f1f77bcf86cd799439011' });
  assert.deepEqual(request.query, { page: 3 });
});

test('returns structured errors for multiple invalid request parts without exposing input values', () => {
  const request = {
    body: { email: 'private-invalid-value', unexpected: 'do-not-echo' },
    params: { userId: 'bad-id' },
    query: { page: '-2', extra: 'sensitive-input' },
  };
  const original = structuredClone(request);
  const result = invokeMiddleware(validateRequest({
    body: z.object({ email: z.string().email() }).strict(),
    params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }).strict(),
    query: z.object({ page: z.coerce.number().int().positive() }).strict(),
  }, 'Request validation failed'), request);

  assert.equal(result.statusCode, 400);
  assert.equal(result.nextCalled, false);
  assert.deepEqual(request, original);
  assert.equal(typeof result.payload, 'object');
  const payload = result.payload as { success: boolean; message: string; code: string; errors: Array<{ field: string; message: string }> };
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Request validation failed');
  assert.equal(payload.code, 'VALIDATION_ERROR');
  assert.deepEqual(payload.errors.map((error) => error.field), ['email', 'unexpected', 'userId', 'page', 'extra']);
  assert.equal(payload.errors.find((error) => error.field === 'unexpected')?.message, 'Unrecognized field');
  assert.equal(payload.errors.find((error) => error.field === 'extra')?.message, 'Unrecognized field');
  assert.ok(payload.errors.every((error) => typeof error.message === 'string' && error.message.length > 0));
  const responseText = JSON.stringify(result.payload);
  assert.ok(!responseText.includes('private-invalid-value'));
  assert.ok(!responseText.includes('do-not-echo'));
  assert.ok(!responseText.includes('sensitive-input'));
  assert.ok(!responseText.includes('stack'));
});

test('does not commit valid parts or execute downstream handlers when any schema fails', () => {
  const request = {
    body: { email: ' USER@example.test ' },
    query: { page: '-1' },
  };
  const bodyBefore = structuredClone(request.body);
  let controllerCalls = 0;
  const result = invokeMiddleware(validateRequest({
    body: z.object({ email: z.string().trim().toLowerCase().email() }).strict(),
    query: z.object({ page: z.coerce.number().int().positive() }).strict(),
  }), request);
  if (result.nextCalled) controllerCalls += 1;

  assert.equal(result.statusCode, 400);
  assert.equal(controllerCalls, 0);
  assert.deepEqual(request.body, bodyBefore);
});

test('accepts a body-only schema and preserves the existing validation response envelope', () => {
  const request = { body: { count: 'not-a-number' } };
  const result = invokeMiddleware(validateRequest({
    body: z.object({ count: z.coerce.number().int() }).strict(),
  }, 'Custom validation failed'), request);

  assert.equal(result.statusCode, 400);
  const payload = result.payload as { success: boolean; message: string; code: string; errors: Array<{ field: string; message: string }> };
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Custom validation failed');
  assert.equal(payload.code, 'VALIDATION_ERROR');
  assert.equal(payload.errors.length, 1);
  assert.equal(payload.errors[0]?.field, 'count');
  assert.ok(payload.errors[0]?.message);
});
