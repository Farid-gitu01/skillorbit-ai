import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sendCreated,
  sendEmptySuccess,
  sendError,
  sendMessage,
  sendPaginated,
  sendSuccess,
} from '../src/utils/api-response.util.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';

function mockResponse() {
  const result: { statusCode?: number; body?: unknown } = {};
  const response = {
    status(statusCode: number) {
      result.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
  return { response: response as never, result };
}

test('success and created helpers preserve explicit status and omit absent fields', () => {
  const get = mockResponse();
  sendSuccess(get.response, 200, { id: 'user-1' });
  assert.equal(get.result.statusCode, 200);
  assert.deepEqual(get.result.body, { success: true, data: { id: 'user-1' } });

  const created = mockResponse();
  sendCreated(created.response, { id: 'user-2' }, 'Created');
  assert.equal(created.result.statusCode, 201);
  assert.deepEqual(created.result.body, { success: true, data: { id: 'user-2' }, message: 'Created' });

  const messageOnly = mockResponse();
  sendMessage(messageOnly.response, 200, 'Done');
  assert.deepEqual(messageOnly.result.body, { success: true, message: 'Done' });
  const emptyAlias = mockResponse();
  sendEmptySuccess(emptyAlias.response, 204, 'Removed');
  assert.equal(emptyAlias.result.statusCode, 204);
  assert.deepEqual(emptyAlias.result.body, { success: true, message: 'Removed' });
});

test('error helper returns structured codes/errors and excludes empty optional fields', () => {
  const { response, result } = mockResponse();
  sendError(response, 400, 'Validation failed', {
    code: 'VALIDATION_ERROR',
    errors: [{ field: 'email', message: 'Invalid email' }],
  });
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors: [{ field: 'email', message: 'Invalid email' }],
  });

  const generic = mockResponse();
  sendError(generic.response, 500, 'Internal Server Error');
  assert.deepEqual(generic.result.body, {
    success: false,
    message: 'Internal Server Error',
    code: 'HTTP_500',
  });
  assert.ok(!JSON.stringify(generic.result.body).includes('stack'));

  const rateLimited = mockResponse();
  sendError(rateLimited.response, 429, 'Too many requests', { code: 'RATE_LIMITED' });
  assert.equal(rateLimited.result.statusCode, 429);
  assert.deepEqual(rateLimited.result.body, {
    success: false,
    message: 'Too many requests',
    code: 'RATE_LIMITED',
  });
});

test('paginated helper places pagination in meta', () => {
  const { response, result } = mockResponse();
  sendPaginated(response, 200, [{ id: 'job-1' }], { page: 1, limit: 20, total: 1, pages: 1 }, 'Jobs');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    success: true,
    data: [{ id: 'job-1' }],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
    message: 'Jobs',
  });
});

test('existing error middleware retains status selection and emits safe standardized errors', () => {
  const { response, result } = mockResponse();
  const originalError = console.error;
  console.error = () => undefined;
  try {
    errorHandler(
      Object.assign(new Error('database connection string leaked'), { statusCode: 500 }),
      { method: 'GET', path: '/test' } as never,
      response as never,
      (() => undefined) as never
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
  });
  assert.ok(!JSON.stringify(result.body).includes('database connection string'));
  assert.ok(!JSON.stringify(result.body).includes('stack'));
});
