import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ZodError, z } from 'zod';
import { asyncHandler } from '../src/middlewares/async-handler.middleware.js';
import { errorHandler, normalizeError } from '../src/middlewares/error.middleware.js';
import { ApplicationError } from '../src/utils/application-error.js';

function mockResponse(headersSent = false) {
  const result: { statusCode?: number; body?: unknown; headersSent: boolean } = { headersSent };
  const res = {
    get headersSent() { return result.headersSent; },
    status(statusCode: number) { result.statusCode = statusCode; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
  return { res: res as never, result };
}

async function runErrorHandler(error: unknown, headersSent = false) {
  const { res, result } = mockResponse(headersSent);
  let forwarded: unknown;
  errorHandler(error as never, { method: 'POST', path: '/api/test', originalUrl: '/api/test?token=hidden' } as never, res, (nextError) => { forwarded = nextError; });
  return { result, forwarded };
}

test('ApplicationError preserves operational status, message, code, and field errors', async () => {
  const error = new ApplicationError('Email already in use', {
    statusCode: 409,
    code: 'EMAIL_IN_USE',
    errors: [{ field: 'email', message: 'Already exists' }],
  });
  const normalized = normalizeError(error);
  assert.equal(normalized.statusCode, 409);
  assert.equal(normalized.code, 'EMAIL_IN_USE');
  assert.deepEqual(normalized.errors, [{ field: 'email', message: 'Already exists' }]);
  const { result } = await runErrorHandler(error);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Email already in use',
    code: 'EMAIL_IN_USE',
    errors: [{ field: 'email', message: 'Already exists' }],
  });
});

test('unexpected errors produce a generic response and sanitized log metadata', async () => {
  const originalError = console.error;
  const logEntries: unknown[] = [];
  console.error = (...args: unknown[]) => { logEntries.push(args); };
  try {
    const { result } = await runErrorHandler(new Error('secret password, token=hidden, mongo URI'));
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, {
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
    });
    const log = JSON.stringify(logEntries);
    assert.ok(!log.includes('secret password'));
    assert.ok(!log.includes('token=hidden'));
    assert.ok(!log.includes('mongo URI'));
    assert.ok(log.includes('POST'));
    assert.ok(log.includes('/api/test'));
    assert.ok(!log.includes('?token='));
    assert.deepEqual(normalizeError(Object.assign(new Error('private database detail'), { statusCode: 400, code: 'private-error-code' })), {
      statusCode: 400,
      message: 'Request failed',
      code: 'HTTP_400',
      operational: true,
    });
  } finally {
    console.error = originalError;
  }
});

test('Zod, Mongoose validation, duplicate key, and cast errors map safely', () => {
  const zodError = z.object({ email: z.string().email() }).safeParse({ email: 'sensitive-value' });
  assert.equal(zodError.success, false);
  if (!zodError.success) {
    const normalized = normalizeError(zodError.error);
    assert.equal(normalized.statusCode, 400);
    assert.equal(normalized.code, 'VALIDATION_ERROR');
    assert.equal(normalized.errors?.[0]?.field, 'email');
    assert.ok(!JSON.stringify(normalized).includes('sensitive-value'));
  }

  const mongooseError = new mongoose.Error.ValidationError();
  mongooseError.addError('email', new mongoose.Error.ValidatorError({ path: 'email', message: 'raw value should not be exposed', value: 'secret-email' }));
  const mongooseNormalized = normalizeError(mongooseError);
  assert.equal(mongooseNormalized.statusCode, 400);
  assert.deepEqual(mongooseNormalized.errors, [{ field: 'email', message: 'Invalid value' }]);
  assert.ok(!JSON.stringify(mongooseNormalized).includes('secret-email'));
  assert.deepEqual(normalizeError(Object.assign(new Error('duplicate key'), { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'private@example.test' } })), {
    statusCode: 409,
    message: 'A record with this value already exists',
    code: 'DUPLICATE_KEY',
    errors: [{ field: 'email', message: 'Already exists' }],
    operational: true,
  });
  const cast = new mongoose.Error.CastError('ObjectId', 'private-id', '_id');
  assert.deepEqual(normalizeError(cast), {
    statusCode: 400,
    message: 'Invalid request value',
    code: 'INVALID_ID',
    operational: true,
  });
});

test('JWT and Express parser errors map to safe client statuses', () => {
  const expired = normalizeError(new jwt.TokenExpiredError('private token', new Date()));
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.code, 'INVALID_AUTHENTICATION');
  assert.equal(expired.message, 'Invalid or expired authentication');
  const invalid = normalizeError(new jwt.JsonWebTokenError('signature contents'));
  assert.equal(invalid.statusCode, 401);
  assert.ok(!JSON.stringify(invalid).includes('signature contents'));
  assert.equal(normalizeError(Object.assign(new Error('body parser raw detail'), { status: 400, type: 'entity.parse.failed' })).code, 'MALFORMED_REQUEST');
  assert.equal(normalizeError(Object.assign(new Error('large body'), { status: 413, type: 'entity.too.large' })).statusCode, 413);
});

test('already-sent responses delegate to Express without writing a second response', async () => {
  const error = new Error('late stream error');
  const { result, forwarded } = await runErrorHandler(error, true);
  assert.equal(result.statusCode, undefined);
  assert.equal(result.body, undefined);
  assert.equal(forwarded, error);
});

test('Express 4 asyncHandler forwards rejected promises to next', async () => {
  const failure = new Error('async failure');
  let forwarded: unknown;
  const middleware = asyncHandler(async () => { throw failure; });
  middleware({} as never, {} as never, (error?: unknown) => { forwarded = error; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(forwarded, failure);
});
